import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Proje kökü (server/src -> ../../) */
export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const SERVER_DIR = path.resolve(__dirname, '..');

// .env'i her zaman server klasöründen yükle (çalışma dizininden bağımsız)
dotenv.config({ path: path.join(SERVER_DIR, '.env') });
export const DATA_DIR = path.join(SERVER_DIR, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'app.db');

export const PORT = parseInt(process.env.PORT || '4000', 10);

export const CLAUDE = {
  apiKey: process.env.CLAUDE_API_KEY || '',
  model: process.env.CLAUDE_MODEL || 'claude-opus-4-8',
  endpoint: 'https://api.anthropic.com/v1/messages',
  apiVersion: '2023-06-01'
};

export const OPENAI = {
  apiKey: process.env.OPENAI_API_KEY || '',
  transcriptionModel: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',
  extractionModel: process.env.OPENAI_EXTRACT_MODEL || 'gpt-4o-mini'
};

export const IMPORT = {
  transcriptionProvider: (process.env.TRANSCRIPTION_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'local')).toLowerCase(),
  extractionProvider: (process.env.EXTRACTION_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'ollama')).toLowerCase(),
  localWhisperPython: process.env.LOCAL_WHISPER_PYTHON || 'python',
  localWhisperScript: path.resolve(SERVER_DIR, process.env.LOCAL_WHISPER_SCRIPT || 'scripts/local-transcribe.py'),
  localWhisperModel: process.env.LOCAL_WHISPER_MODEL || 'medium',
  localWhisperDevice: process.env.LOCAL_WHISPER_DEVICE || 'cuda',
  localWhisperComputeType: process.env.LOCAL_WHISPER_COMPUTE_TYPE || 'int8_float16',
  localWhisperInitialPrompt: process.env.LOCAL_WHISPER_INITIAL_PROMPT ||
    'TÜBİTAK 1831 Yeşil Dönüşüm müşteri görüşmesi. Firma, NACE kodu, MERSİS, karbon ayak izi, su ayak izi, su verimliliği, Mavi Sertifika, emisyon, atık, enerji, sürdürülebilirlik, ISO 14001, ISO 14046, ISO 14064, iş paketi.',
  ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_EXTRACT_MODEL || 'qwen2.5:7b'
};

export const CHATGPT = {
  profileDir: path.join(DATA_DIR, 'chatgpt-profile'),
  // Görünür tarayıcı (ChatGPT otomasyonu headless'te genelde engellenir)
  headless: process.env.CHATGPT_HEADLESS === 'true',
  // 'chrome' → sistemde kurulu Google Chrome'u kullan; boş → Playwright Chromium
  channel: process.env.CHATGPT_CHANNEL || '',
  baseUrl: process.env.CHATGPT_URL || 'https://chatgpt.com/',
  navTimeoutMs: 120000,
  responseTimeoutMs: parseInt(process.env.CHATGPT_RESPONSE_TIMEOUT || '300000', 10)
};

export const GOOGLE = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  templateDocId: process.env.TEMPLATE_DOC_ID || ''
};

export const RECIPIENTS = (process.env.RECIPIENTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const VAULT_PATH = path.resolve(
  SERVER_DIR,
  process.env.KNOWLEDGE_VAULT_PATH || '../knowledge'
);
