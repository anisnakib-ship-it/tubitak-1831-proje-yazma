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
