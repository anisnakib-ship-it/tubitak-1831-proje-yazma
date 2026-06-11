import fs from 'node:fs';
import path from 'node:path';
import { runConversation } from './chatgpt-web.js';
import {
  loadVault, parseIndex, getSectionNote, getScopeNote, getGlobalNotesText
} from './knowledge.js';
import { buildDocRequests } from './docbuilder.js';
import { createDocument, clearDocument, applyRequests, shareDocument, docUrl } from './google.js';
import { getTemplate, DEFAULT_TEMPLATE_ID } from '../templates.js';
import { parseDocx, isDocx } from './docx.js';

const ANALYSIS_LABELS = {
  companyName: 'Şirket Adı',
  sector: 'Faaliyet Alanı / Sektör',
  nace: 'NACE Kodu',
  products: 'Ürünler ve Markalar',
  employees: 'Çalışan / İnsan Kaynağı Yapısı',
  waterRegulationStatus: 'Su Verimliliği Yönetmeliği Kapsamı',
  currentWaterUse: 'Mevcut Su Kullanımı',
  selectedProduct: 'Seçilen Ürün ve İşlevsel Birim',
  carbonActivityData: 'Faaliyet Verileri (enerji, yakıt, hammadde, atık, lojistik)',
  projectScope: 'Proje Kapsamı',
  projectNeed: 'Projeye İhtiyaç Nedenleri',
  workToBeDone: 'Proje Kapsamında Yapılacak Çalışmalar',
  workPackages: 'İş Paketleri (Tablo)',
  collaborations: 'Ulusal / Uluslararası İşbirlikleri',
  pastProjects: 'Geçmiş Projeler ve Deneyim',
  infrastructure: 'Fiziki ve Sermaye Altyapısı',
  notes: 'Ek Notlar'
};

function formatAnalysis(analysis = {}) {
  const lines = ['ŞİRKET ANALİZ FORMU', ''];
  for (const [key, label] of Object.entries(ANALYSIS_LABELS)) {
    const val = analysis[key];
    if (val == null || String(val).trim() === '') continue;
    lines.push(`${label}: ${String(val).trim()}`);
  }
  for (const [key, val] of Object.entries(analysis)) {
    if (ANALYSIS_LABELS[key]) continue;
    if (val == null || String(val).trim() === '') continue;
    lines.push(`${key}: ${String(val).trim()}`);
  }
  return lines.join('\n');
}

function readUploadedFiles(files = []) {
  const chunks = [];
  for (const f of files) {
    try {
      const name = f.original_name || f.stored_path;
      const ext = path.extname(f.stored_path).toLowerCase();
      const raw = fs.readFileSync(f.stored_path);
      let text;
      if (isDocx(name) || isDocx(f.stored_path)) {
        text = parseDocx(raw);                       // Word belgeleri (.docx)
      } else if (['.txt', '.md', '.csv', '.json'].includes(ext)) {
        text = raw.toString('utf8');                 // Düz metin
      } else {
        text = raw.toString('utf8').replace(/[^\x09\x0A\x0D\x20-\x7E -ɏİıĞğŞşÇçÖöÜü]+/g, ' '); // en iyi çaba
      }
      if (text && text.trim().length > 20) {
        chunks.push(`=== EK BELGE: ${name} ===\n${text.trim().slice(0, 20000)}`);
      }
    } catch { /* yok say */ }
  }
  return chunks.join('\n\n');
}

/**
 * ChatGPT'ye gönderilecek giriş mesajını ve 13 soruyu kurar (ChatGPT çağrısı YOK).
 * Hem üretim hem test bu aynı mantığı kullanır.
 * @returns {{ template, introMessage, questions }}
 */
export function buildMessages({ companyName, projectType, analysis = {}, files = [] }) {
  const template = getTemplate(projectType) || getTemplate(DEFAULT_TEMPLATE_ID);
  const analysisText = formatAnalysis({ companyName, ...analysis });
  const filesText = readUploadedFiles(files);
  const fullAnalysis = filesText ? `${analysisText}\n\n${filesText}` : analysisText;

  const vault = loadVault();
  const index = parseIndex(vault, template.folder);
  if (!index.indexNote) {
    throw new Error(`"${template.labelTr}" türü için indeks bulunamadı (knowledge/${template.folder}/00-index.md).`);
  }
  const scopeNote = getScopeNote(vault, template.folder);
  const globalText = getGlobalNotesText(vault);

  const introMessage = `TÜBİTAK 1831 Yeşil İnovasyon Teknoloji Mentörlüğü Programı kapsamında, aşağıdaki şirket için bir proje başvurusu yazacağız. Sana 13 soru soracağım; her soruyu YALNIZCA sorulan kapsamda, **Türkçe** ve verilen kurallara harfiyen uyarak yanıtla. Başlık/numara ekleme, sadece istenen metni yaz.

=== PROJE TÜRÜ ===
${template.labelTr} — Süre: ${template.months} ay, ${template.workPackages} iş paketi.

${scopeNote ? `=== TÜR KAPSAMI VE KURALLARI ===\n${scopeNote.body}\n` : ''}
=== ORTAK KURALLAR ===
${globalText}

=== ŞİRKET ANALİZ FORMU ===
${fullAnalysis}

Bu bağlamı okuduğunu kısaca onayla. Ardından soruları tek tek göndereceğim.`;

  const questions = [];
  for (let n = 1; n <= 13; n++) {
    const note = getSectionNote(vault, template.folder, n);
    const title = note?.title || `Bölüm ${n}`;
    const guideline = note?.body || '';
    let prompt = `SORU ${n} — ${title}\nAşağıdaki kurallara KESİNLİKLE uyarak bu bölümü Türkçe yaz. Sadece bölüm metnini döndür.\n\n${guideline}`;

    // Soru 7 (İş Planı): kullanıcının girdiği iş paketleri tablosunu/çalışmaları doğrudan ve esas alınacak şekilde ekle
    if (n === 7) {
      const wp = (analysis.workPackages || '').trim();
      const wtbd = (analysis.workToBeDone || '').trim();
      if (wp || wtbd) {
        prompt += `\n\n=== KULLANICININ GİRDİĞİ İŞ PAKETLERİ (ÖNCELİKLİ — BUNU ESAS AL) ===`;
        if (wtbd) prompt += `\nProje Kapsamında Yapılacak Çalışmalar:\n${wtbd}`;
        if (wp) prompt += `\nİş Paketleri Tablosu:\n${wp}`;
        prompt += `\n\nÖNEMLİ: İş paketlerinin ADLARINI, SAYISINI ve ÇIKTI adlarını yukarıdaki tablodan AYNEN al. Kılavuzdaki örnek/varsayılan iş paketi adlarını ve çıktı adlarını KULLANMA. Sadece toplam program süresi sabittir (${template.months} ay); tablodaki ayları bu süreyle uyumlu olacak şekilde yaz.`;
      }
    }

    questions.push({ number: n, title, prompt });
  }

  return { template, introMessage, questions };
}

/**
 * 13 bölüm metnini ChatGPT konuşması üzerinden üretir (Google adımı YOK).
 * @returns {Promise<{ answers, template }>}
 */
export async function generateAnswers({ companyName, projectType, analysis, files = [], onProgress = () => {} }) {
  const { template, introMessage, questions } = buildMessages({ companyName, projectType, analysis, files });

  // --- ChatGPT konuşmasını yürüt ---
  const answers = await runConversation({ introMessage, questions, onProgress });

  // Boş yanıt kontrolü
  const empty = answers.filter((a) => !a.content || a.content.trim().length < 10);
  if (empty.length > 0) {
    throw new Error(`ChatGPT bazı bölümler için yanıt döndürmedi (${empty.map((a) => a.number).join(', ')}). Tarayıcı oturumunu/arayüzü kontrol edin.`);
  }

  return { answers, template };
}

/**
 * Üretilen 13 yanıttan Google Dokümanı oluşturur, biçimlendirir ve paylaşır.
 * @returns {Promise<{ docId, url }>}
 */
export async function buildProjectDoc({ companyName, template, answers, onProgress = () => {} }) {
  onProgress({ step: 'document', message: 'Google Dokümanı oluşturuluyor...' });
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const dateStr = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const title = `TÜBİTAK 1831 - ${companyName} - ${template.labelTr}`;

  const docId = await createDocument(title);
  await clearDocument(docId);
  const requests = buildDocRequests(companyName, dateStr, answers, template.labelTr);
  await applyRequests(docId, requests);

  onProgress({ step: 'share', message: 'Doküman paylaşılıyor...' });
  await shareDocument(docId);

  return { docId, url: docUrl(docId) };
}

/** Tam akış (yanıt üretimi + doküman) — kolaylık için. */
export async function runGeneration(opts) {
  const { answers, template } = await generateAnswers(opts);
  const { docId, url } = await buildProjectDoc({ companyName: opts.companyName, template, answers, onProgress: opts.onProgress });
  return { docId, url, answers };
}
