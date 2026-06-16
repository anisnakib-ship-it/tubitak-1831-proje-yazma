import fs from 'node:fs';
import path from 'node:path';
import { runConversation } from './chatgpt-web.js';
import {
  loadVault, parseIndex, getSectionNote, getScopeNote, getGlobalNotesText, getGuidelineForSection
} from './knowledge.js';
import { buildDocRequests } from './docbuilder.js';
import { createDocument, clearDocument, applyRequests, shareDocument, docUrl } from './google.js';
import { getTemplate, DEFAULT_TEMPLATE_ID } from '../templates.js';
import { parseDocx, isDocx } from './docx.js';
import { parsePdf, isPdf } from './pdf.js';

const ANALYSIS_LABELS = {
  // --- TÜBİTAK 1831 standart formu ---
  companyName: 'Firma Tam Adı',
  owners: 'Firma Sahibi ve Ortakları',
  shares: 'Ortakların Hisse Oranları',
  taxNo: 'Vergi No',
  address: 'Adres',
  locations: 'Faaliyet Lokasyonları, Birimleri ve Alan Bilgileri',
  phone: 'Telefon',
  web: 'Web Adresi',
  email: 'E-posta Adresi',
  foundingDate: 'Firma Kuruluş Tarihi',
  sectorNace: 'Sektör / NACE Kodu',
  suppliers: 'Tedarikçiler',
  products: 'Ürünler ve Markalar',
  foundingStory: 'İşletmenin Kuruluş Hikâyesi',
  currentActivities: 'Mevcut Faaliyetleri',
  foreignTrade: 'Dış Ticaret Yapma Durumu',
  foreignCountries: 'Dış Ticaret Yapılan Ülkeler',
  customerCount: 'Yıllık Ortalama Müşteri Sayısı',
  competitiveFactors: 'Firmayı Önemli Kılan Faktörler',
  pastProjects: 'Geçmiş Proje Tecrübeleri',
  rdCapability: 'Ar-Ge Yetkinliği ve Proje Geçmişi',
  ecoProduction: 'Çevre Dostu Üretim Süreci / Çalışmaları',
  mentor: 'Mentor Kuruluş / Kişi',
  documents: 'Mevcut Belgeler',
  personnel: 'Personel Sayıları (Ar-Ge/Üretim/Diğer, cinsiyet ve eğitim)',
  workAreas: 'Hangi Alanda Proje Yürütülecek (EVET seçilenler)',
  projectScopeItems: 'Projenin Kapsamı (EVET seçilenler)',
  needReasons: 'Projeye İhtiyaç Gerekçeleri / Problem Tanımı (EVET seçilenler)',
  expectedResults: 'Program Kapsamında Beklenen Sonuçlar',
  projectName: 'Projenin Adı',

  // --- Ortak / su verimliliği alanları ---
  workToBeDone: 'Proje Kapsamında Yapılacak Çalışmalar',
  workPackages: 'İş Paketleri (Tablo)',
  waterRegulationStatus: 'Su Verimliliği Yönetmeliği Kapsamı',
  currentWaterUse: 'Mevcut Su Kullanımı ve Su/Atıksu Verileri',
  waterTargets: 'Su Verimliliği Hedefleri',
  notes: 'Ek Notlar'
};

function valToText(val) {
  if (Array.isArray(val)) return val.filter(Boolean).join(', ');
  return String(val).trim();
}

function formatAnalysis(analysis = {}) {
  const lines = ['ŞİRKET ANALİZ FORMU', ''];
  const seen = new Set();
  for (const [key, label] of Object.entries(ANALYSIS_LABELS)) {
    const val = analysis[key];
    seen.add(key);
    if (val == null || valToText(val) === '') continue;
    lines.push(`${label}: ${valToText(val)}`);
  }
  for (const [key, val] of Object.entries(analysis)) {
    if (seen.has(key)) continue;
    if (val == null || valToText(val) === '') continue;
    lines.push(`${key}: ${valToText(val)}`);
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
      } else if (isPdf(name) || isPdf(f.stored_path)) {
        text = parsePdf(raw);                        // PDF belgeleri (.pdf)
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
  // İş paketleri belgeleri ayrı tutulur; geri kalan dosyalar genel bağlama eklenir
  const wpFiles = files.filter((f) => f.kind === 'workpackages');
  const generalFiles = files.filter((f) => f.kind !== 'workpackages');
  const filesText = readUploadedFiles(generalFiles);
  const wpDocText = readUploadedFiles(wpFiles);
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
  const count = template.questionCount || 13;
  for (let n = 1; n <= count; n++) {
    const note = getSectionNote(vault, template.folder, n);
    const title = note?.title || `Bölüm ${n}`;
    // Kılavuz metni grafikten derlenir: o türün indeksinde bu bölüme bağlanan
    // notlar (wikilink) izlenir. Global notlar intro'da olduğu için burada hariç.
    // İndekste eşleme yoksa birincil section-NN notuna geri düşülür.
    const graphGuideline = getGuidelineForSection(vault, index, n, { includeGlobal: false }).trim();
    const guideline = graphGuideline || note?.body || '';
    let prompt = `SORU ${n} — ${title}\nAşağıdaki kurallara KESİNLİKLE uyarak bu bölümü Türkçe yaz. Sadece bölüm metnini döndür.\n\n${guideline}`;

    // İş Planı sorusu: kullanıcının girdiği iş paketleri tablosunu/çalışmaları doğrudan ve esas alınacak şekilde ekle
    if (/İş\s*Plan/i.test(title)) {
      const wp = (analysis.workPackages || '').trim();
      const wtbd = (analysis.workToBeDone || '').trim();
      const wpDoc = (wpDocText || '').trim();
      if (wp || wtbd || wpDoc) {
        prompt += `\n\n=== KULLANICININ GİRDİĞİ İŞ PAKETLERİ (ÖNCELİKLİ — BUNU ESAS AL) ===`;
        if (wtbd) prompt += `\nProje Kapsamında Yapılacak Çalışmalar:\n${wtbd}`;
        if (wp) prompt += `\nİş Paketleri Tablosu:\n${wp}`;
        if (wpDoc) prompt += `\nİş Paketleri Belgesi (yüklenen):\n${wpDoc}`;
        prompt += `\n\nÖNEMLİ: İş paketlerinin ADLARINI, SAYISINI ve ÇIKTI adlarını yukarıdaki bilgilerden AYNEN al. Kılavuzdaki örnek/varsayılan iş paketi adlarını ve çıktı adlarını KULLANMA. Sadece toplam program süresi sabittir (${template.months} ay); ayları bu süreyle uyumlu olacak şekilde yaz.`;
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
