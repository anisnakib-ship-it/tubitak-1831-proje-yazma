import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import db from '../db.js';
import { SERVER_DIR } from '../config.js';

/**
 * Bilgi (knowledge) katmanı — ARTIK VERİTABANI DESTEKLİ.
 *
 * Eskiden `knowledge/` Obsidian vault'undan okunuyordu; tüm prompt belgeleri,
 * program kapsamları, iş paketleri, ortak kurallar ve bölüm uzunlukları artık
 * SQLite'ta (`programs`, `program_sections`, `global_rules`) yaşar ve platform
 * içindeki Yönetim ekranından düzenlenir. (En son kazanır; geçmiş tutulmaz.)
 *
 * İlk açılışta tablolar boşsa `server/knowledge-seed.json` dosyasından tohumlanır.
 */

const SEED_PATH = path.join(SERVER_DIR, 'knowledge-seed.json');

// ---------------------------------------------------------------------------
// Okuma (üretim akışı — generator.js bunları kullanır)
// ---------------------------------------------------------------------------

export function getProgramBySlug(slug) {
  return db.prepare(`SELECT * FROM programs WHERE slug = ?`).get(slug) || null;
}

export function listSections(programId) {
  return db
    .prepare(`SELECT * FROM program_sections WHERE program_id = ? ORDER BY number ASC`)
    .all(programId);
}

export function getSection(programId, number) {
  return db
    .prepare(`SELECT * FROM program_sections WHERE program_id = ? AND number = ?`)
    .get(programId, number) || null;
}

/** Ortak kuralların (eski _global) birleşik metni — intro mesajına eklenir. */
export function getGlobalRulesText() {
  const rows = db.prepare(`SELECT title, body FROM global_rules ORDER BY sort ASC`).all();
  return rows.map((r) => `### ${r.title}\n${r.body || ''}`).join('\n\n');
}

// ---------------------------------------------------------------------------
// CRUD (Yönetim ekranı — routes/admin.js)
// ---------------------------------------------------------------------------

export const Knowledge = {
  listPrograms() {
    return db.prepare(`SELECT * FROM programs ORDER BY sort ASC, label_tr ASC`).all();
  },

  getProgram(id) {
    const program = db.prepare(`SELECT * FROM programs WHERE id = ?`).get(id);
    if (!program) return null;
    return { ...program, sections: listSections(id) };
  },

  updateProgram(id, fields) {
    const allowed = ['label_tr', 'label_en', 'desc_tr', 'desc_en', 'months',
      'work_packages', 'question_count', 'scope_text', 'wp_body', 'sort', 'active'];
    const sets = [];
    const values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = ?`);
      values.push(v);
    }
    if (sets.length === 0) return this.getProgram(id);
    values.push(id);
    db.prepare(`UPDATE programs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.getProgram(id);
  },

  updateSection(sectionId, fields) {
    const allowed = ['title', 'prompt_body', 'max_chars', 'target_words'];
    const sets = [];
    const values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = ?`);
      values.push(v === '' ? null : v);
    }
    if (sets.length === 0) return null;
    values.push(sectionId);
    db.prepare(`UPDATE program_sections SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare(`SELECT * FROM program_sections WHERE id = ?`).get(sectionId);
  },

  listGlobalRules() {
    return db.prepare(`SELECT * FROM global_rules ORDER BY sort ASC`).all();
  },

  createGlobalRule({ title, body = '', sort = 0 }) {
    const id = randomUUID();
    db.prepare(`INSERT INTO global_rules (id, title, body, sort) VALUES (?, ?, ?, ?)`)
      .run(id, title, body, sort);
    return db.prepare(`SELECT * FROM global_rules WHERE id = ?`).get(id);
  },

  updateGlobalRule(id, fields) {
    const allowed = ['title', 'body', 'sort'];
    const sets = [];
    const values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = ?`);
      values.push(v);
    }
    if (sets.length === 0) return db.prepare(`SELECT * FROM global_rules WHERE id = ?`).get(id);
    values.push(id);
    db.prepare(`UPDATE global_rules SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare(`SELECT * FROM global_rules WHERE id = ?`).get(id);
  },

  deleteGlobalRule(id) {
    db.prepare(`DELETE FROM global_rules WHERE id = ?`).run(id);
  }
};

// ---------------------------------------------------------------------------
// Dışa / İçe aktar (Export / Import JSON) — tohum biçimiyle aynı
// ---------------------------------------------------------------------------

export function exportKnowledge() {
  const programs = Knowledge.listPrograms().map((p) => ({
    slug: p.slug,
    label_tr: p.label_tr,
    label_en: p.label_en,
    desc_tr: p.desc_tr,
    desc_en: p.desc_en,
    months: p.months,
    work_packages: p.work_packages,
    question_count: p.question_count,
    scope_text: p.scope_text || '',
    sort: p.sort,
    active: p.active,
    work_package_body: p.wp_body || '',
    sections: listSections(p.id).map((s) => ({
      number: s.number,
      title: s.title,
      prompt_body: s.prompt_body || '',
      max_chars: s.max_chars,
      target_words: s.target_words
    }))
  }));
  const global_rules = Knowledge.listGlobalRules().map((r) => ({
    title: r.title, body: r.body || '', sort: r.sort
  }));
  return { version: 1, exported_at: new Date().toISOString(), global_rules, programs };
}

/** Tüm bilgiyi verilen tohum/dışa-aktarım nesnesiyle DEĞİŞTİRİR (en son kazanır). */
export function importKnowledge(data) {
  if (!data || !Array.isArray(data.programs)) {
    throw new Error('Geçersiz bilgi dosyası: "programs" dizisi bulunamadı.');
  }
  const insProgram = db.prepare(`
    INSERT INTO programs (id, slug, label_tr, label_en, desc_tr, desc_en, months,
      work_packages, question_count, scope_text, wp_body, sort, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insSection = db.prepare(`
    INSERT INTO program_sections (id, program_id, number, title, prompt_body, max_chars, target_words)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const insRule = db.prepare(`INSERT INTO global_rules (id, title, body, sort) VALUES (?, ?, ?, ?)`);

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM program_sections');
    db.exec('DELETE FROM programs');
    db.exec('DELETE FROM global_rules');

    for (const [pi, p] of data.programs.entries()) {
      const programId = randomUUID();
      insProgram.run(
        programId, p.slug, p.label_tr, p.label_en ?? '', p.desc_tr ?? '', p.desc_en ?? '',
        p.months ?? 6, p.work_packages ?? 4, p.question_count ?? 13,
        p.scope_text ?? '', p.work_package_body ?? p.wp_body ?? '',
        p.sort ?? pi, p.active ?? 1
      );
      for (const s of p.sections || []) {
        insSection.run(
          randomUUID(), programId, s.number, s.title ?? `Bölüm ${s.number}`,
          s.prompt_body ?? '', s.max_chars ?? null, s.target_words ?? null
        );
      }
    }
    for (const [ri, r] of (data.global_rules || []).entries()) {
      insRule.run(randomUUID(), r.title, r.body ?? '', r.sort ?? ri);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Tablolar boşsa tohum dosyasından doldur (ilk açılış / yeni sunucu). */
export function seedIfEmpty() {
  const count = db.prepare(`SELECT COUNT(*) AS n FROM programs`).get().n;
  if (count > 0) return { seeded: false, programs: count };
  if (!fs.existsSync(SEED_PATH)) {
    console.warn(`  ⚠ Bilgi tohumu bulunamadı: ${SEED_PATH} — programlar boş.`);
    return { seeded: false, programs: 0 };
  }
  const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  importKnowledge(data);
  const n = db.prepare(`SELECT COUNT(*) AS n FROM programs`).get().n;
  console.log(`  ✓ Bilgi tohumlandı: ${n} program (${SEED_PATH})`);
  return { seeded: true, programs: n };
}

// ---------------------------------------------------------------------------
// Sağlık kontrolü — /api/knowledge/health
// ---------------------------------------------------------------------------

export function knowledgeHealth() {
  const programs = Knowledge.listPrograms();
  const rules = Knowledge.listGlobalRules();
  const types = programs.map((p) => {
    const sections = listSections(p.id).map((s) => ({
      section: s.number,
      ok: !!(s.prompt_body && s.prompt_body.trim().length > 0),
      chars: (s.prompt_body || '').length
    }));
    return {
      id: p.slug, label: p.label_tr,
      hasScope: !!(p.scope_text && p.scope_text.trim()),
      mappedSections: sections.filter((s) => s.ok).length,
      sections
    };
  });
  return {
    source: 'database',
    globalRules: rules.map((r) => r.title),
    types
  };
}
