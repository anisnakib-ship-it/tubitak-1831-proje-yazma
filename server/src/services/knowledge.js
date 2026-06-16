import fs from 'node:fs';
import path from 'node:path';
import { VAULT_PATH } from '../config.js';
import { TEMPLATES, getTemplate } from '../templates.js';

/**
 * Çok-türlü Obsidian bilgi grafiği okuyucusu.
 *
 * Yapı:
 *   knowledge/_global/            → tüm türlerde otomatik kullanılan ortak notlar
 *   knowledge/<tür-klasörü>/      → her proje türünün intro + 13 bölüm notu
 *       00-index.md               → o türün 13 sorusunu notlara eşler
 *
 * Üretimde her bölüm için: _global notları + o türün index'inde o bölüme
 * bağlanan notlar prompt'a enjekte edilir.
 */

const WIKILINK_RE = /\[\[([^\]|#]+?)(?:[#|][^\]]*)?\]\]/g;
const GLOBAL_FOLDER = '_global';

function walkMarkdown(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)\s*$/);
    if (m) data[m[1].trim()] = m[2].trim();
  }
  return { data, body: raw.slice(match[0].length) };
}

const baseName = (file) => path.basename(file, path.extname(file));
const normKey = (s) => String(s).trim().toLowerCase();

/** Bir dosyanın VAULT_PATH altındaki ilk klasör segmentini döndürür. */
function topFolder(file) {
  const rel = path.relative(VAULT_PATH, file);
  const parts = rel.split(path.sep);
  return parts.length > 1 ? parts[0] : '';
}

/** Tüm vault'u belleğe yükler. */
export function loadVault() {
  const files = walkMarkdown(VAULT_PATH);
  const notes = new Map();          // key -> note
  const byFolder = new Map();       // folder -> note[]

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const bn = baseName(file);
    const folder = topFolder(file);
    const note = {
      name: data.name || bn, fileName: bn, folder,
      title: data.title || bn, description: data.description || '',
      data, body: body.trim(), file
    };
    notes.set(normKey(bn), note);
    if (data.name) notes.set(normKey(data.name), note);
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(note);
  }

  return { notes, byFolder, vaultPath: VAULT_PATH, count: files.length };
}

function extractLinks(text) {
  const links = [];
  let m;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(text)) !== null) links.push(m[1].trim());
  return links;
}

/** Bir türün index notunu bulur (klasöründe adı 'index' içeren not). */
function findIndexNote(vault, folder) {
  const notes = vault.byFolder.get(folder) || [];
  return notes.find((n) => n.fileName.toLowerCase().includes('index')) || null;
}

/** _global klasöründeki tüm notların adları (her bölüme uygulanır). */
function globalNoteNames(vault) {
  return (vault.byFolder.get(GLOBAL_FOLDER) || []).map((n) => n.name);
}

/**
 * Bir türün index notunu ayrıştırır: Soru N → [not adları].
 */
export function parseIndex(vault, folder) {
  const perSection = new Map();
  const indexNote = findIndexNote(vault, folder);
  if (!indexNote) return { perSection, global: globalNoteNames(vault), indexNote: null };

  let current = null;
  for (const line of indexNote.body.split('\n')) {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      const num = normKey(heading[1]).match(/(?:soru|q|bölüm|bolum)\s*0*(\d{1,2})/);
      current = num ? parseInt(num[1], 10) : null;
    }
    const inlineNum = line.match(/(?:soru|q|bölüm|bolum)\s*0*(\d{1,2})/i);
    const links = extractLinks(line);
    if (links.length === 0) continue;
    const target = inlineNum ? parseInt(inlineNum[1], 10) : current;
    if (target == null) continue;
    if (!perSection.has(target)) perSection.set(target, []);
    const arr = perSection.get(target);
    for (const l of links) if (!arr.includes(l)) arr.push(l);
  }

  return { perSection, global: globalNoteNames(vault), indexNote };
}

/** _global klasöründeki notların birleşik metni (intro mesajına eklenir). */
export function getGlobalNotesText(vault) {
  const notes = vault.byFolder.get(GLOBAL_FOLDER) || [];
  return notes.map((n) => `### ${n.title}\n${n.body}`).join('\n\n');
}

/** Bir türün kapsam/scope notu (sistem promptuna eklenir). */
export function getScopeNote(vault, folder) {
  const notes = vault.byFolder.get(folder) || [];
  return notes.find((x) => x.fileName.toLowerCase() === 'scope') || null;
}

/** Bir türün belirli bölümünün birincil notu (section-NN). */
export function getSectionNote(vault, folder, n) {
  const padded = String(n).padStart(2, '0');
  const notes = vault.byFolder.get(folder) || [];
  return notes.find((x) => x.fileName.toLowerCase().startsWith(`section-${padded}`)) || null;
}

/**
 * Bir bölüm için kılavuz metnini derler (global notlar + bölüme bağlı notlar).
 * @param {object} [opts]
 * @param {boolean} [opts.includeGlobal=true] _global notları da dahil et.
 *   Üretimde intro mesajı global notları zaten taşıdığı için false geçilir.
 */
export function getGuidelineForSection(vault, index, n, { includeGlobal = true } = {}) {
  const wanted = [...(includeGlobal ? index.global : []), ...(index.perSection.get(n) || [])];
  const seen = new Set();
  const chunks = [];
  for (const link of wanted) {
    const key = normKey(link);
    if (seen.has(key)) continue;
    seen.add(key);
    const note = vault.notes.get(key);
    if (!note) { chunks.push(`> [Uyarı] Kılavuz notu bulunamadı: [[${link}]]`); continue; }
    chunks.push(`### ${note.title}\n${note.body}`);
  }
  return chunks.join('\n\n');
}

/** Tüm türler için sağlık kontrolü. */
export function vaultHealth() {
  const vault = loadVault();
  const types = TEMPLATES.map((tpl) => {
    const index = parseIndex(vault, tpl.folder);
    const sections = [];
    const count = tpl.questionCount || 13;
    for (let n = 1; n <= count; n++) {
      const g = getGuidelineForSection(vault, index, n);
      sections.push({ section: n, ok: g.trim().length > 0, chars: g.length });
    }
    return {
      id: tpl.id, label: tpl.labelTr, folder: tpl.folder,
      hasIndex: !!index.indexNote, mappedSections: sections.filter((s) => s.ok).length, sections
    };
  });
  return {
    vaultPath: vault.vaultPath, noteCount: vault.count,
    globalNotes: globalNoteNames(vault), types
  };
}
