import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import OpenAI from 'openai';
import { IMPORT, OPENAI } from '../config.js';
import { parseDocx } from './docx.js';
import { parsePdf } from './pdf.js';
import { formFor } from '../../../web/src/forms.js';

const AUDIO_EXTENSIONS = new Set(['.flac', '.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.ogg', '.wav', '.webm']);
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json', '.rtf']);
const MAX_TRANSCRIPT_CHARS = 500000;
const MAX_MODEL_TRANSCRIPT_CHARS = 60000;
const MISSING_VALUE_RE = /^(not provided(?: in the transcript)?|not mentioned|unknown|n\/a|null|bilgi yok|bilgi bulunmadı|yeterli bilgi verilmedi|belirsiz|belirtilmedi|verilmedi|yok)$/i;
const SHORT_FIELD_MAX = 180;
const SHORT_FIELDS = new Set([
  'companyName', 'owners', 'shares', 'taxNo', 'foundingDate', 'sectorNace', 'employees',
  'phone', 'web', 'email', 'foreignTrade', 'foreignCountries', 'customerCount', 'mentor',
  'projectName'
]);

const CHECKLIST_KEYWORDS = {
  projectScopeItems: {
    'Mevcut Durum Analizi': ['mevcut durum analizi'],
    'Veri Toplama ve Değerlendirme': ['veri toplama', 'faaliyet verilerinin toplanması', 'değerlendirme'],
    'Boşluk Analizi ve İyileştirme Alanlarının Belirlenmesi': ['boşluk analizi', 'iyileştirme fırsat'],
    'Çözüm Önerileri ve Stratejik Planlama': ['çözüm öner', 'stratejik plan'],
    'Karbon Ayak İzi Yönetimi': ['karbon ayak izi', 'karbon emisyon', 'emisyon kaynak'],
    'Su Ayak İzi ve Yönetimi': ['su ayak izi'],
    'Enerji Verimliliği ve Yenilenebilir Enerji Kullanımı': ['enerji verimliliği', 'yenilenebilir enerji'],
    'Atık Yönetimi ve Döngüsel Ekonomi Uygulamaları': ['atık yönetimi', 'döngüsel ekonomi'],
    'Ürün Yaşam Döngüsü Analizi (LCA)': ['yaşam döngüsü', 'lca'],
    'Yeşil Tedarik Zinciri Yönetimi': ['yeşil tedarik', 'tedarik zinciri'],
    'Yeşil Lojistik ve Taşımacılık Optimizasyonu': ['yeşil lojistik', 'taşımacılık optimizasyon'],
    'Dijital Karbon İzleme ve Raporlama Sistemleri': ['dijital karbon', 'karbon izleme'],
    'Sınırda Karbon Vergisi ve Uluslararası Mevzuatlara Uyum (SKDM)': ['skdm', 'sınırda karbon'],
    'Sürdürülebilir Ürün Sertifikasyonu ve Eko-Etiketleme': ['eko-etiket', 'eko etiket', 'sürdürülebilir ürün sertifik'],
    'Yeşil Finans ve ESG Raporlaması': ['yeşil finans', 'esg'],
    'Çalışan Eğitimi ve Farkındalık Programları': ['çalışan eğitimi', 'farkındalık'],
    'Sürdürülebilirlik Kültürü ve İç Yönetim Politikalarının Geliştirilmesi': ['sürdürülebilirlik kültürü', 'iç yönetim politika'],
    'Sürekli İyileştirme ve Performans Takibi': ['sürekli iyileştirme', 'performans takibi'],
    'Yeşil İnovasyon ve Teknoloji Kullanımı': ['yeşil inovasyon']
  },
  needReasons: {
    'Doğal Kaynakları Korumak': ['doğal kaynak'],
    'Çevre Bilincini Artırmak': ['çevre bilinci', 'çalışan farkındalığı'],
    'Sürdürülebilir İş Modeli Oluşturmak': ['sürdürülebilir iş modeli'],
    'Enerji Verimliliğini Artırma': ['enerji verimliliği', 'enerji tüketimi'],
    'İnovatif Ürün ve Hizmet Geliştirme': ['inovatif ürün', 'yenilikçi ürün'],
    'Toplumsal Katkı Sağlama': ['toplumsal katkı'],
    'Uluslararası Standartlara Uyum': ['uluslararası standart'],
    'Karbon Emisyonlarının Hesaplanması': ['karbon emisyonlarının hesaplanması', 'karbon ayak izi hesab'],
    'Uzun Vadeli Stratejik Planlama': ['uzun vadeli', 'yeşil dönüşüm plan'],
    'Çevresel Etkiyi Azaltma': ['çevresel etkiyi azalt'],
    'Kurumsal İmaj ve Marka Değeri': ['kurumsal imaj', 'marka değeri'],
    'Regülasyonlara Uyum': ['regülasyon', 'mevzuat'],
    'Maliyet Avantajı': ['maliyet avantaj'],
    'Yenilik ve Rekabet Gücü': ['rekabet gücü'],
    'Paydaş Beklentileri': ['müşterilerimiz', 'paydaş beklenti'],
    'Kurumsal Sosyal Sorumluluk': ['kurumsal sosyal sorumluluk'],
    'Pazar Fırsatları': ['pazar fırsat'],
    'Risk Yönetimi': ['risk yönetimi']
  },
  documents: {
    'Çevre Ruhsatı ve İzni': ['çevre ruhsat'],
    'Atık Yönetim Planı': ['atık yönetim plan'],
    'Atık Beyan Formu': ['atık beyan'],
    'Atık Su Deşarj İzinleri ve Kanal Bağlantı İzni': ['atık su deşarj', 'kanal bağlantı'],
    'Atık Su Analiz Sonuçları': ['atık su analiz'],
    'Hava Emisyon Raporu': ['hava emisyon raporu'],
    'Gürültü Ölçüm Sonuçları': ['gürültü ölçüm'],
    'Koku Emisyon Ölçüm Sonuçları': ['koku emisyon'],
    'Acil Müdahale Planı': ['acil müdahale plan'],
    'ISO 14001 – Çevre Yönetim Sistemi': ['iso 14001'],
    'ISO 50001 – Enerji Yönetim Sistemi': ['iso 50001'],
    'ISO 14064 – Karbon Ayak İzi Doğrulama': ['iso 14064'],
    'ISO 14067 – Ürün Karbon Ayak İzi': ['iso 14067'],
    'ISO 14046 – Su Ayak İzi': ['iso 14046'],
    'GOTS – Global Organic Textile Standard': ['gots'],
    'OCS – Organic Content Standard': ['ocs'],
    'RCS – Recycled Claim Standard': ['rcs'],
    'GRS – Global Recycled Standard': ['grs'],
    'SLCP – Social & Labor Convergence Program': ['slcp', 's-c-l-p']
  }
};

let client;

function openai() {
  if (!OPENAI.apiKey) throw new Error('OPENAI_API_KEY tanımlı değil (.env).');
  if (!client) client = new OpenAI({ apiKey: OPENAI.apiKey });
  return client;
}

function extOf(file) {
  return path.extname(file?.originalname || file?.path || '').toLowerCase();
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function lowerTr(text) {
  return String(text || '').toLocaleLowerCase('tr').replace(/ı/g, 'i');
}

function cleanValue(text) {
  return String(text || '')
    .replace(/^["'“”‘’\s:,-]+|["'“”‘’\s:,-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function digitsOnly(text) {
  return String(text || '').replace(/\D/g, '');
}

function normalizeEvidence(text) {
  return lowerTr(text)
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function evidenceAppears(evidence, transcript) {
  const ev = normalizeEvidence(evidence);
  if (ev.length < 8) return false;
  return normalizeEvidence(transcript).includes(ev);
}

function looksLikeQuestion(text) {
  const value = lowerTr(text);
  return /\?/.test(value) ||
    /(?:^|[\s,;:])(?:mi|mu|mü|nedir|nelerdir|kaç|hangi|kimdir|var mi|yok mu|yapiyor musunuz|yapiyor mu|söyler misiniz|paylaşir misiniz|tanimlar misiniz)(?=$|[\s,;:.?!])/u.test(value);
}

function matchFirst(text, regex) {
  const m = text.match(regex);
  return m ? cleanValue(m[1]) : '';
}

function checklistOptionSupported(key, option, evidence) {
  const normalizedEvidence = lowerTr(evidence);
  const keywords = CHECKLIST_KEYWORDS[key]?.[option] || [];
  const candidates = [option, ...keywords].map(lowerTr);
  return candidates.some((candidate) => {
    if (!normalizedEvidence.includes(candidate)) return false;
    const clause = normalizedEvidence
      .split(/\b(?:ancak|fakat|ama)\b|[.;\n]/u)
      .find((part) => part.includes(candidate)) || normalizedEvidence;
    if (key === 'projectScopeItems' && /\b(?:daha önce|geçmiş|tamamladik|tamamlandi|önceki proje)\b/u.test(clause) &&
        !/\b(?:istiyoruz|planliyoruz|yapilacak|uygulanacak|kapsaminda|hedefliyoruz|destek almak)\b/u.test(clause)) {
      return false;
    }
    return !/\b(?:yok|değil|degil|bulunmuyor|mevcut değil|mevcut degil|sahip değiliz|sahip degiliz|henüz yok)\b/u.test(clause);
  });
}

function extractPercentShares(transcript) {
  const found = [];
  const re = /([A-ZÇĞİÖŞÜ][\p{L}'-]+(?:\s+[A-ZÇĞİÖŞÜ][\p{L}'-]+)+)\s*(?:%|yüzde\s+)(\d{1,3})/giu;
  let m;
  while ((m = re.exec(transcript)) !== null) {
    found.push(`${cleanValue(m[1])} %${m[2]}`);
  }
  return found;
}

function transcriptForModel(transcript) {
  if (transcript.length <= MAX_MODEL_TRANSCRIPT_CHARS) return transcript;
  const half = Math.floor(MAX_MODEL_TRANSCRIPT_CHARS / 2);
  return `${transcript.slice(0, half)}

[... UZUN TRANSKRIPTIN ORTA KISMI KISALTILDI; yalnızca açıkça verilen bilgileri çıkar ...]

${transcript.slice(-half)}`;
}

function numberTranscriptLines(transcript) {
  const segments = normalizeText(transcript)
    .split('\n')
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[\p{L}\d])/u))
    .map((line) => normalizeText(line))
    .filter(Boolean);
  const lineMap = new Map();
  const numbered = segments.map((line, index) => {
    const id = `L${String(index + 1).padStart(4, '0')}`;
    lineMap.set(id, line);
    return `[${id}] ${line}`;
  });
  return { text: numbered.join('\n'), lineMap };
}

function isAudio(file) {
  const ext = extOf(file);
  return AUDIO_EXTENSIONS.has(ext) || /^audio\//i.test(file?.mimetype || '');
}

function isTextLike(file) {
  const ext = extOf(file);
  return (
    TEXT_EXTENSIONS.has(ext) ||
    ext === '.docx' ||
    ext === '.pdf' ||
    /^text\//i.test(file?.mimetype || '')
  );
}

function readTranscriptFile(file) {
  const ext = extOf(file);
  const raw = fs.readFileSync(file.path);
  if (ext === '.docx') return parseDocx(raw);
  if (ext === '.pdf') return parsePdf(raw);
  if (isTextLike(file)) return raw.toString('utf8');
  throw new Error('Desteklenmeyen dosya türü. Ses için mp3/wav/m4a/webm/ogg/flac; metin için txt/md/docx/pdf yükleyin.');
}

function runProcess(command, args, { timeoutMs = 30 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Yerel Whisper işlemi zaman aşımına uğradı.'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}`));
    });
  });
}

async function transcribeAudioOpenAI(file) {
  const result = await openai().audio.transcriptions.create({
    file: fs.createReadStream(file.path),
    model: OPENAI.transcriptionModel,
    response_format: 'json',
    language: 'tr',
    prompt: 'TÜBİTAK 1831 Yeşil Dönüşüm müşteri analiz görüşmesi. Şirket adı, NACE, ürünler, belgeler, karbon ayak izi, su verimliliği, Mavi Sertifika, iş paketleri ve proje kapsamı terimleri geçebilir.'
  });
  return normalizeText(result.text || '');
}

async function transcribeAudioLocal(file) {
  if (!fs.existsSync(IMPORT.localWhisperScript)) {
    throw new Error(`Yerel Whisper betiği bulunamadı: ${IMPORT.localWhisperScript}`);
  }

  const transcribeArgs = (device, computeType) => [
    IMPORT.localWhisperScript,
    '--file', file.path,
    '--model', IMPORT.localWhisperModel,
    '--device', device,
    '--compute-type', computeType,
    '--language', 'tr',
    '--initial-prompt', IMPORT.localWhisperInitialPrompt
  ];

  if (IMPORT.localWhisperDevice === 'cuda') {
    try {
      await fetch(`${IMPORT.ollamaUrl.replace(/\/+$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: IMPORT.ollamaModel, keep_alive: 0 })
      });
    } catch { /* Whisper can continue even when Ollama is not running. */ }
  }

  let stdout;
  try {
    ({ stdout } = await runProcess(IMPORT.localWhisperPython, transcribeArgs(
      IMPORT.localWhisperDevice,
      IMPORT.localWhisperComputeType
    )));
  } catch (err) {
    if (IMPORT.localWhisperDevice !== 'cuda') throw err;
    ({ stdout } = await runProcess(
      IMPORT.localWhisperPython,
      transcribeArgs('cpu', 'int8'),
      { timeoutMs: 60 * 60 * 1000 }
    ));
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Yerel Whisper çıktısı okunamadı: ${err.message}`);
  }
  if (parsed.error) throw new Error(parsed.error);
  return normalizeText(parsed.text || '');
}

export async function transcribeAudio(file) {
  if (IMPORT.transcriptionProvider === 'local') return transcribeAudioLocal(file);
  if (IMPORT.transcriptionProvider === 'openai') return transcribeAudioOpenAI(file);
  throw new Error(`Bilinmeyen transkripsiyon sağlayıcısı: ${IMPORT.transcriptionProvider}`);
}

export async function transcriptFromInput({ file, transcript }) {
  const parts = [];
  const pasted = normalizeText(transcript);
  let transcribed = false;

  if (pasted) parts.push(pasted);

  if (file) {
    if (isAudio(file)) {
      const text = await transcribeAudio(file);
      if (text) parts.push(text);
      transcribed = true;
    } else {
      const text = normalizeText(readTranscriptFile(file));
      if (text) parts.push(text);
    }
  }

  const combined = normalizeText(parts.join('\n\n'));
  if (!combined) throw new Error('Analiz formunu doldurmak için ses dosyası veya transkript metni gerekli.');
  return {
    transcript: combined.length > MAX_TRANSCRIPT_CHARS ? combined.slice(0, MAX_TRANSCRIPT_CHARS) : combined,
    truncated: combined.length > MAX_TRANSCRIPT_CHARS,
    transcribed
  };
}

function allFields(projectType) {
  return formFor(projectType).flatMap((group) =>
    group.fields.map((field) => ({
      ...field,
      groupTr: group.labelTr,
      groupEn: group.labelEn
    }))
  );
}

function fieldLabel(field) {
  return `${field.groupTr} / ${field.tr} (${field.key})`;
}

function schemaForFields(fields) {
  const properties = {};
  const evidenceProperties = {};
  const required = [];

  for (const field of fields) {
    required.push(field.key);
    evidenceProperties[field.key] = {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: `Exact answer quote supporting ${field.tr}; null when the field is empty.`
    };
    if (field.type === 'checklist') {
      properties[field.key] = {
        type: 'array',
        items: { type: 'string', enum: field.options },
        description: `${field.tr}. Return only options explicitly supported by the transcript.`
      };
    } else {
      properties[field.key] = {
        anyOf: [{ type: 'string' }, { type: 'null' }],
        description: field.tr
      };
    }
  }

  return {
    type: 'object',
    properties: {
      analysis: {
        type: 'object',
        properties,
        required,
        additionalProperties: false
      },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short warnings about ambiguous or missing information.'
      },
      evidence: {
        type: 'object',
        properties: evidenceProperties,
        required,
        additionalProperties: false
      }
    },
    required: ['analysis', 'evidence', 'notes'],
    additionalProperties: false
  };
}

function schemaForEvidenceItems(fields) {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', enum: fields.map((field) => field.key) },
            value: {
              anyOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } }
              ]
            },
            evidenceLineIds: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['key', 'value', 'evidenceLineIds'],
          additionalProperties: false
        }
      },
      notes: { type: 'array', items: { type: 'string' } }
    },
    required: ['items', 'notes'],
    additionalProperties: false
  };
}

function extractionPrompt({ fields, transcript }) {
  const fieldList = fields.map((field) => {
    const optionText = field.options?.length ? ` Options: ${field.options.join(' | ')}` : '';
    return `- ${fieldLabel(field)}.${optionText}`;
  }).join('\n');

  return `You extract a TÜBİTAK 1831 customer analysis form from a call transcript.

Return an analysis object, an evidence object with the same field keys, and notes.

Rules:
- Use only information that is explicitly stated or unmistakably confirmed in the transcript.
- Extract answers, not the interviewer's questions. A standalone question is never evidence.
- When speakers are labelled, use customer answers. When they are not labelled, use the declarative answer following a question, never the question itself.
- Do not invent numbers, capacities, dates, certificates, exports, customers, investments, machinery, or project details.
- Write concise, coherent Turkish values. Omit garbled or uncertain phrases and add a note instead.
- If a text field is not answered, return null for that field.
- For checklist fields, select only the provided options. Return [] when no option is clearly supported.
- For each non-empty field, evidence must be a short exact quote copied from the customer's answer. Use null evidence for empty fields.
- Respect negation. A document, capability, export market, or activity mentioned only in a question or denied by the customer is not present.
- Prefer Turkish output because the final application is Turkish.

Form fields:
${fieldList}

Transcript:
${transcript}`;
}

function evidencePrompt({ fields, transcript }) {
  const fieldList = fields
    .map((field) => {
      const optionText = field.options?.length ? ` Options: ${field.options.join(' | ')}` : '';
      return `- ${field.key}: ${field.groupTr} / ${field.tr}.${optionText}`;
    })
    .join('\n');

  return `Extract only clearly stated customer-analysis form fields from this Turkish call transcript.

Return JSON only in this shape:
{
  "items": [
    { "key": "fieldKey", "value": "field value in Turkish", "evidenceLineIds": ["L0001"] }
  ],
  "notes": []
}

Strict rules:
- Only use these field keys:
${fieldList}
- Cover every supported field, including company details, numeric fields, contact information, narrative fields, and checklists.
- Extract answers, not the interviewer's questions. Text ending in "?", "var mı", "kaç", "hangi", or similar question language is never an answer.
- When speaker labels exist, use customer answers. Without labels, use only declarative answer passages, not the preceding question.
- Every item must cite only the numbered customer-answer lines that support its value.
- Never cite a question line. If a question and answer are on separate lines, cite only the answer line.
- You may cite multiple non-contiguous answer lines when a field needs them.
- If a field is not explicitly stated, omit it.
- Do not write "not provided", "unknown", or similar placeholders.
- Respect negation and do not select checklist options merely because the interviewer named them.
- Checklist values must be arrays containing only the listed options.
- Do not infer beyond the transcript or add generic sustainability language.
- Keep values concise and coherent. If transcription text is garbled or uncertain, omit that part and add a note.

Transcript:
${transcript}`;
}

function parseJsonText(content, sourceLabel) {
  if (!content.trim()) throw new Error(`${sourceLabel} boş analiz yanıtı döndürdü.`);
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`${sourceLabel} analiz yanıtı JSON olarak okunamadı: ${err.message}`);
  }
}

function parseOpenAIModelJson(completion) {
  const message = completion.choices?.[0]?.message;
  if (message?.refusal) throw new Error(`OpenAI yanıtı reddetti: ${message.refusal}`);
  return parseJsonText(message?.content || '', 'OpenAI');
}

function heuristicAnalysis(transcript) {
  const out = {};
  const shares = extractPercentShares(transcript);
  const ownerNames = shares.map((s) => s.replace(/\s+%\d+$/, ''));

  const companyName =
    matchFirst(transcript, /firma adımız\s+(.+?)(?=\s+(?:\d{4}\s+yılında|vergi|nace|toplam|danışman:)|[.\r\n]|$)/iu) ||
    matchFirst(transcript, /firma tam adı\s*[:,-]\s*(.+?)(?=\s+(?:\d{4}\s+yılında|vergi|nace|toplam|danışman:)|[.\r\n]|$)/iu) ||
    matchFirst(transcript, /şirket(?:imizin)? adı\s+(.+?)(?=\s+(?:\d{4}\s+yılında|vergi|nace|toplam|danışman:)|[.\r\n]|$)/iu);
  if (companyName) out.companyName = companyName;

  const owners = ownerNames.length ? ownerNames.join(', ') : matchFirst(transcript, /ortak(?:larımız)? var,?\s*([^.\n]+)/iu);
  if (owners) out.owners = owners;
  if (shares.length) out.shares = shares.join('; ');

  const taxNoRaw = matchFirst(transcript, /vergi numaramız\s*([0-9][0-9\s-]{5,})/iu) || matchFirst(transcript, /vergi no(?:muz|su)?\s*([0-9][0-9\s-]{5,})/iu);
  const taxNo = digitsOnly(taxNoRaw);
  if (taxNo.length >= 6) out.taxNo = taxNo;

  const foundingDate = matchFirst(transcript, /(\d{4})\s+yılında[^.\n]*kuruldu/iu);
  if (foundingDate) out.foundingDate = foundingDate;

  const sectorNace = matchFirst(transcript, /nace kodumuz\s*([0-9]+(?:\.[0-9]+)?[^.\n]*)/iu);
  if (sectorNace) out.sectorNace = sectorNace;

  const employees = matchFirst(transcript, /(?:toplam\s*)?(\d+)\s+çalışan/iu);
  if (employees) out.employees = employees;

  const address = matchFirst(transcript, /adresimiz\s*([^.\n]+)/iu);
  if (address) out.address = address;

  const phone = matchFirst(transcript, /telefon\s*([0-9\s()+-]{7,})/iu);
  if (digitsOnly(phone).length >= 7) out.phone = phone;

  const web = matchFirst(transcript, /web sitemiz\s*([^,\s]+)/iu) || matchFirst(transcript, /\b((?:www\.)[^\s,.;]+)/iu);
  if (web) out.web = web;

  const email =
    matchFirst(transcript, /e-?posta\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?=[\s,.;]|$)/iu) ||
    matchFirst(transcript, /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/iu);
  if (email) out.email = email;

  const products =
    matchFirst(transcript, /ürünlerimiz\s*([^.\n]+)/iu) ||
    matchFirst(transcript, /müşteri:\s*([^.\n]*(?:yapıyoruz|üretiyoruz|sunuyoruz)[^.\n]*(?:\.\s*[^.\n]*markalarıyla çalışıyoruz)?)/iu);
  if (products) out.products = products;

  const suppliers = matchFirst(transcript, /tedarikçilerimiz\s*([^.\n]+)/iu);
  if (suppliers) out.suppliers = suppliers;

  const personnel = matchFirst(transcript, /(üretim ekibimiz\s*[^.\n]+)/iu);
  if (personnel) out.personnel = personnel;

  const foreignTrade = matchFirst(transcript, /(dış ticaret\s+(?:yapıyoruz|yapmıyoruz|var|yok)[^.\n]*)/iu);
  if (foreignTrade) out.foreignTrade = foreignTrade;

  const foreignCountries =
    matchFirst(transcript, /([A-ZÇĞİÖŞÜ][\p{L}-]+(?:\s*(?:,|ve)\s*[A-ZÇĞİÖŞÜ][\p{L}-]+)*)['’]?(?:ya|ye|a|e)\s+(?:satışımız|ihracatımız|ihracat)\s+var/iu) ||
    matchFirst(transcript, /(?:ihracat|satış)\s+yapılan\s+ülkeler\s*[:,-]?\s*([^.\n]+)/iu);
  if (foreignCountries) out.foreignCountries = foreignCountries;

  const customerCount = matchFirst(transcript, /yıllık ortalama\s+(\d+)\s+müşteri/iu);
  if (customerCount) out.customerCount = customerCount;

  const expectedResults =
    matchFirst(transcript, /(kurumsal karbon ayak izi raporu[^.\n]*bekliyoruz)/iu) ||
    matchFirst(transcript, /beklenen sonuç(?:lar)?\s*[:,-]?\s*([^.\n]+)/iu);
  if (expectedResults) out.expectedResults = expectedResults;

  const workToBeDone =
    matchFirst(transcript, /yapılacak çalışmalar\s*([^.\n]+)/iu) ||
    matchFirst(transcript, /faaliyet verilerinin toplanması,\s*([^.\n]+)/iu) ||
    matchFirst(transcript, /müşteri:\s*(mevcut durum analizi[^.\n]+destek almak istiyoruz)/iu);
  if (workToBeDone) out.workToBeDone = workToBeDone;

  for (const key of ['projectScopeItems', 'documents']) {
    const values = keywordSelections(key, transcript);
    if (values.length) out[key] = values;
  }

  return out;
}

function cleanExtracted(rawAnalysis, fields, transcript = '') {
  const heuristic = heuristicAnalysis(transcript);
  const out = {};

  for (const field of fields) {
    const value = rawAnalysis?.[field.key];
    if (field.type === 'checklist') {
      const selected = Array.isArray(value)
        ? value.filter((item) => field.options.includes(item))
        : [];
      const keywordBacked = keywordSelections(field.key, transcript);
      const safeSelected = keywordBacked.length
        ? selected.filter((item) => keywordBacked.includes(item))
        : [];
      const merged = [...new Set([...(heuristic[field.key] || []), ...safeSelected])];
      if (merged.length) out[field.key] = merged;
      continue;
    }

    if (typeof value === 'string') {
      const text = normalizeText(value);
      if (text && !MISSING_VALUE_RE.test(text)) out[field.key] = text;
    }
  }

  for (const [key, value] of Object.entries(heuristic)) {
    if (Array.isArray(value)) out[key] = [...new Set([...(out[key] || []), ...value])];
    else if (value) out[key] = value;
  }

  return out;
}

function normalizeSuggestions(parsed) {
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (parsed?.analysis && typeof parsed.analysis === 'object') {
    return Object.entries(parsed.analysis)
      .filter(([, value]) => typeof value === 'string' && value.trim())
      .map(([key, value]) => ({ key, value, evidence: value }));
  }
  return [];
}

function plausibleSuggestion(key, value) {
  if (!MODEL_TEXT_FIELDS.has(key)) return false;
  if (!value || MISSING_VALUE_RE.test(value)) return false;
  if (['foreignTrade', 'foreignCountries', 'customerCount', 'projectName'].includes(key) && value.length > SHORT_FIELD_MAX) return false;
  if (/danışman:|müşteri:/i.test(value) && value.length > 240) return false;
  return true;
}

function cleanSuggestions(parsed, fields, transcript = '') {
  const fieldKeys = new Set(fields.map((field) => field.key));
  const out = {};
  const evidence = {};
  const rejected = [];

  for (const item of normalizeSuggestions(parsed)) {
    const key = String(item?.key || '').trim();
    const value = normalizeText(item?.value || '');
    const quote = normalizeText(item?.evidence || '');

    if (!fieldKeys.has(key)) {
      rejected.push(`${key || '(empty)'}: unknown field`);
      continue;
    }
    if (!plausibleSuggestion(key, value)) {
      rejected.push(`${key}: implausible value`);
      continue;
    }
    if (!evidenceAppears(quote, transcript)) {
      rejected.push(`${key}: evidence not found in transcript`);
      continue;
    }

    out[key] = value;
    evidence[key] = quote;
  }

  return { extracted: out, evidence, rejected };
}

export function heuristicSuggestionsV2(transcript) {
  const items = [];
  const addMatch = (key, regex, transform = cleanValue) => {
    const matcher = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
    for (const match of transcript.matchAll(matcher)) {
      if (looksLikeQuestion(match[0])) continue;
      const value = transform(match[1]);
      if (value) items.push({ key, value, evidence: normalizeText(match[0]) });
      return;
    }
  };

  addMatch('companyName', /(?:firma adımız|şirketimizin adı)\s+([^.\n]+)/iu);
  addMatch('companyName', /firma tam adı\s*[:,-]\s*([^.\n]+)/iu);
  addMatch('taxNo', /(?:vergi numaramız|vergi no(?:muz|su)?)\s*[:,-]?\s*([0-9][0-9\s-]{5,})/iu, digitsOnly);
  addMatch('foundingDate', /(\d{4})(?:\s+yılında|['’]?(?:de|da))[^.\n]*\bkurul(?:du|duk|muş)/iu);
  addMatch('sectorNace', /nace(?:\s+kodu(?:muz)?)?\s*[:,-]?\s*([0-9]+(?:\.[0-9]+)?[^.\n]*)/iu);
  addMatch('employees', /(?:toplam\s*)?(\d+)\s+çalışan(?:ımız)?\b/iu);
  addMatch('address', /adresimiz\s*[:,-]?\s*([^.\n]+)/iu);
  addMatch('phone', /telefon(?:umuz)?\s*[:,-]?\s*([0-9\s()+-]{7,})/iu);
  addMatch('web', /(?:web\s+site(?:miz|si)?\s*[:,-]?\s*)?((?:https?:\/\/|www\.)[^\s,;]+)/iu, (value) => cleanValue(value).replace(/[.]+$/, ''));
  addMatch('email', /(?:e-?posta\s*[:,-]?\s*)?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/iu);
  addMatch('foreignTrade', /(dış ticaret\s+(?:yapıyoruz|yapmıyoruz)|(?:dış ticaret|ihracat|ithalat)(?:ımız)?\s+(?:var|yok))\b[^.\n]*/iu);
  addMatch('customerCount', /yıllık ortalama(?:da)?\s+(\d+(?:\s*[-–]\s*\d+)?)\s+müşteri/iu);

  const clauses = transcript
    .split(/\n|(?<=[.!?])\s+/u)
    .map((clause) => normalizeText(clause))
    .filter((clause) => clause.length >= 8 && !looksLikeQuestion(clause));
  for (const key of ['projectScopeItems', 'documents']) {
    for (const option of Object.keys(CHECKLIST_KEYWORDS[key] || {})) {
      const evidence = clauses.find((clause) => checklistOptionSupported(key, option, clause));
      if (evidence) items.push({ key, value: [option], evidence });
    }
  }

  return { items };
}

function normalizeSuggestionsV2(parsed) {
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (parsed?.analysis && typeof parsed.analysis === 'object') {
    return Object.entries(parsed.analysis)
      .filter(([, value]) => (Array.isArray(value) && value.length) || (typeof value === 'string' && value.trim()))
      .map(([key, value]) => ({ key, value, evidence: parsed.evidence?.[key] || '' }));
  }
  return [];
}

function plausibleSuggestionV2(field, value) {
  const normalized = lowerTr(value);
  if (!value || MISSING_VALUE_RE.test(value) || looksLikeQuestion(value)) return false;
  if (SHORT_FIELDS.has(field.key) && value.length > SHORT_FIELD_MAX) return false;
  if (/danışman:|müşteri:/iu.test(value) && value.length > 240) return false;
  if (field.key === 'companyName' && value.length < 3) return false;
  if (field.key === 'taxNo' && !/^\d{6,20}$/.test(digitsOnly(value))) return false;
  if (field.key === 'foundingDate' && !/\b(?:18|19|20)\d{2}\b/.test(value)) return false;
  if (field.key === 'employees' && !/\d/.test(value)) return false;
  if (field.key === 'phone' && digitsOnly(value).length < 7) return false;
  if (field.key === 'web' && !/^(?:https?:\/\/|www\.)[^\s]+\.[^\s]+$/iu.test(value)) return false;
  if (field.key === 'email' && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/iu.test(value)) return false;
  if (field.key === 'customerCount' && !/\d/.test(value)) return false;
  if (field.key === 'sectorNace' && !/\b\d{2}(?:\.\d{1,2})?\b/u.test(value)) return false;
  if (field.key === 'foreignTrade' && !/(?:diş\s+ticaret|ihracat|ithalat|ihraç|yurt\s+dişina\s+satiş)/u.test(normalized)) return false;
  return true;
}

function evidenceFitsField(field, evidence) {
  const normalized = lowerTr(evidence);
  if (field.key === 'sectorNace') {
    return /\bnace(?:\s+kodu)?\b/u.test(normalized) && /\b\d{2}(?:\.\d{1,2})?\b/u.test(normalized);
  }
  if (field.key === 'locations') {
    return /\b(?:adres|tesis|fabrika|yerleşke|organize\s+sanayi|osb|metrekare|m²|lokasyon|ilçe|şube|atölye|depo)\b/u.test(normalized);
  }
  if (field.key === 'address') {
    return /\b(?:adres|mahalle|mahallesi|cadde|caddesi|sokak|bulvar|no|kat|daire|ilçe|organize\s+sanayi|osb)\b/u.test(normalized);
  }
  if (field.key === 'foreignTrade') {
    return /(?:diş\s+ticaret|ihracat|ithalat|ihraç|yurt\s+dişina\s+satiş)/u.test(normalized);
  }
  if (field.key === 'rdCapability') {
    return /\b(?:ar-ge|arge|araştirma|geliştirme|mühendis|laboratuvar|patent|tübitak|kosgeb|proje ekibi)\b/u.test(normalized);
  }
  if (field.key === 'currentActivities') {
    return /\b(?:faaliyet|üretim|üretiyoruz|üretiyor|yapiyoruz|yapiyor|sunuyoruz|hizmet veriyoruz|işletiyoruz|gerçekleştiriyoruz)\b/u.test(normalized);
  }
  return true;
}

const GROUNDING_STOP_WORDS = new Set([
  've', 'veya', 'ile', 'bir', 'bu', 'şu', 'da', 'de', 'için', 'olarak', 'var', 'yok'
]);

function groundingTokens(text) {
  return (lowerTr(text).match(/[\p{L}\p{N}]+/gu) || [])
    .filter((token) => /^\d+$/u.test(token) || (token.length >= 3 && !GROUNDING_STOP_WORDS.has(token)));
}

function valueIsGrounded(value, evidence) {
  const valueTokens = groundingTokens(value);
  if (!valueTokens.length) return false;
  const evidenceTokens = groundingTokens(evidence);

  const valueNumbers = valueTokens.filter((token) => /^\d+$/u.test(token));
  const evidenceNumbers = new Set(evidenceTokens.filter((token) => /^\d+$/u.test(token)));
  if (valueNumbers.some((number) => !evidenceNumbers.has(number))) return false;

  const wordTokens = valueTokens.filter((token) => !/^\d+$/u.test(token));
  if (!wordTokens.length) return true;
  const supported = wordTokens.filter((token) => evidenceTokens.some((candidate) =>
    candidate === token ||
    (Math.min(candidate.length, token.length) >= 4 && (candidate.startsWith(token) || token.startsWith(candidate)))
  ));
  return supported.length / wordTokens.length >= 0.7;
}

export function validateExtractionResult(parsed, fields, transcript = '', lineMap = null) {
  const fieldMap = new Map(fields.map((field) => [field.key, field]));
  const extracted = {};
  const evidence = {};
  const rejected = [];

  for (const item of normalizeSuggestionsV2(parsed)) {
    const inferredKey = item?.key || Object.keys(item || {}).find((candidate) => fieldMap.has(candidate));
    const key = String(inferredKey || '').trim();
    const field = fieldMap.get(key);

    if (!field) {
      rejected.push(`${key || '(empty)'}: unknown field`);
      continue;
    }
    let quote;
    if (Array.isArray(item?.evidenceLineIds) && lineMap) {
      const citedLines = [...new Set(item.evidenceLineIds)]
        .map((id) => {
          const match = String(id).match(/^L?(\d+)$/i);
          const normalizedId = match ? `L${match[1].padStart(4, '0')}` : String(id);
          return lineMap.get(normalizedId);
        })
        .filter(Boolean);
      const answerLines = citedLines.filter((line) => !looksLikeQuestion(line));
      if (!answerLines.length) {
        rejected.push(`${key}: evidence has no answer lines`);
        continue;
      }
      quote = normalizeText(answerLines.join(' '));
    } else {
      quote = normalizeText(item?.evidence || '');
      if (!evidenceAppears(quote, transcript)) {
        rejected.push(`${key}: evidence not found in transcript`);
        continue;
      }
      if (looksLikeQuestion(quote)) {
        rejected.push(`${key}: evidence is a question`);
        continue;
      }
    }
    if (!evidenceFitsField(field, quote)) {
      rejected.push(`${key}: evidence does not support this field`);
      continue;
    }

    if (field.type === 'checklist') {
      const selected = field.options.filter((option) => checklistOptionSupported(key, option, quote));
      if (!selected.length) {
        rejected.push(`${key}: checklist selection lacks answer evidence`);
        continue;
      }
      extracted[key] = [...new Set([...(extracted[key] || []), ...selected])];
      evidence[key] = quote;
      continue;
    }

    const rawValue = item?.key ? item.value : item?.[key];
    let value = Array.isArray(rawValue)
      ? rawValue.map((part) => normalizeText(part)).filter(Boolean).join('; ')
      : normalizeText(rawValue || '');
    if (key === 'taxNo') value = digitsOnly(value);
    if (key === 'foundingDate') value = value.match(/\b(?:18|19|20)\d{2}\b/)?.[0] || value;
    if (key === 'web') value = value.replace(/[.,;]+$/, '');
    if (!plausibleSuggestionV2(field, value)) {
      rejected.push(`${key}: implausible value`);
      continue;
    }
    if (!valueIsGrounded(value, quote)) {
      rejected.push(`${key}: value adds details not supported by evidence`);
      continue;
    }

    extracted[key] = value;
    evidence[key] = quote;
  }

  return { extracted, evidence, rejected };
}

export async function extractAnalysisFromTranscript({ projectType, transcript }) {
  const fields = allFields(projectType);
  const modelTranscript = transcriptForModel(transcript);
  const numberedTranscript = numberTranscriptLines(modelTranscript);
  let parsed;

  if (IMPORT.extractionProvider === 'openai') {
    parsed = await extractWithOpenAI({ fields, transcript: modelTranscript });
  } else if (IMPORT.extractionProvider === 'ollama') {
    parsed = await extractWithOllama({ fields, transcript: numberedTranscript.text });
  } else {
    throw new Error(`Bilinmeyen form çıkarım sağlayıcısı: ${IMPORT.extractionProvider}`);
  }

  const model = validateExtractionResult(parsed, fields, transcript, numberedTranscript.lineMap);
  const heuristic = validateExtractionResult(heuristicSuggestionsV2(transcript), fields, transcript);
  const extracted = { ...heuristic.extracted, ...model.extracted };
  for (const field of fields.filter((candidate) => candidate.type === 'checklist')) {
    const combined = [...(heuristic.extracted[field.key] || []), ...(model.extracted[field.key] || [])];
    if (combined.length) extracted[field.key] = [...new Set(combined)];
  }
  const evidence = { ...heuristic.evidence, ...model.evidence };
  const rejected = [...model.rejected, ...heuristic.rejected].filter((item) => {
    const key = item.split(':')[0];
    return !extracted[key];
  });

  return {
    extracted,
    evidence,
    notes: [
      ...(Array.isArray(parsed.notes) ? parsed.notes.filter(Boolean).map(String) : []),
      ...rejected.map((x) => `Reddedildi: ${x}`)
    ],
    rawResult: parsed,
    rejected
  };
}

async function extractWithOpenAI({ fields, transcript }) {
  const completion = await openai().chat.completions.create({
    model: OPENAI.extractionModel,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: 'You are a careful form extraction assistant. You fill only fields grounded in the source transcript.'
      },
      { role: 'user', content: extractionPrompt({ fields, transcript }) }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'analysis_form_extraction',
        strict: true,
        schema: schemaForFields(fields)
      }
    }
  });

  return parseOpenAIModelJson(completion);
}

async function extractWithOllama({ fields, transcript }) {
  const baseUrl = IMPORT.ollamaUrl.replace(/\/+$/, '');
  const batches = fields.length > 12
    ? [fields.slice(0, 12), fields.slice(12, 24), fields.slice(24)]
    : [fields];
  const parsedBatches = [];

  for (const batch of batches.filter((items) => items.length)) {
    parsedBatches.push(await requestOllamaBatch({ baseUrl, fields: batch, transcript }));
  }

  return {
    items: parsedBatches.flatMap((batch) => Array.isArray(batch.items) ? batch.items : []),
    notes: parsedBatches.flatMap((batch) => Array.isArray(batch.notes) ? batch.notes : []),
    batches: parsedBatches
  };
}

async function requestOllamaBatch({ baseUrl, fields, transcript }) {
  const prompt = evidencePrompt({ fields, transcript });
  let response;
  let connectionError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: IMPORT.ollamaModel,
          prompt,
          stream: false,
          format: schemaForEvidenceItems(fields),
          keep_alive: '10m',
          options: { temperature: 0, num_ctx: 16384, num_predict: 4096 }
        })
      });
      break;
    } catch (err) {
      connectionError = err;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  if (!response) {
    const cause = connectionError?.cause?.code || connectionError?.message || 'unknown connection error';
    throw new Error(`Ollama bağlantısı kurulamadı (${baseUrl}). Ollama çalışıyor mu? ${cause}`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Ollama HTTP hatası ${response.status}: ${text.slice(0, 300)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Ollama yanıtı okunamadı: ${err.message}`);
  }

  return parseJsonText(data.response || '', 'Ollama');
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export function mergeAnalysis({ current = {}, extracted = {}, mode = 'fill-empty' }) {
  const merged = { ...current };
  const filledKeys = [];
  const skippedKeys = [];

  for (const [key, value] of Object.entries(extracted)) {
    const canOverwrite = mode === 'overwrite';
    if (canOverwrite || !hasValue(merged[key])) {
      merged[key] = value;
      filledKeys.push(key);
    } else {
      skippedKeys.push(key);
    }
  }

  return { analysis: merged, filledKeys, skippedKeys };
}
