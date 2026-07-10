import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { PORT, GOOGLE, VAULT_PATH, CHATGPT, OPENAI, IMPORT } from './config.js';
import './db.js'; // şemayı başlat
import projectsRouter from './routes/projects.js';
import generateRouter from './routes/generate.js';
import knowledgeRouter from './routes/knowledge.js';
import chatgptRouter from './routes/chatgpt.js';
import { closeBrowser } from './services/chatgpt-web.js';
import { TEMPLATES } from './templates.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Sağlık / yapılandırma durumu
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    engine: 'chatgpt-web',
    chatgptProfile: fs.existsSync(CHATGPT.profileDir),
    googleConfigured: !!(GOOGLE.clientId && GOOGLE.clientSecret && GOOGLE.refreshToken),
    openaiConfigured: !!OPENAI.apiKey,
    importConfigured: IMPORT.transcriptionProvider !== 'openai' || !!OPENAI.apiKey,
    transcriptionProvider: IMPORT.transcriptionProvider,
    extractionProvider: IMPORT.extractionProvider,
    extractionModel: IMPORT.extractionProvider === 'ollama' ? IMPORT.ollamaModel : OPENAI.extractionModel,
    vaultPath: VAULT_PATH
  });
});

// Proje türleri (şablonlar)
app.get('/api/templates', (req, res) => {
  res.json(TEMPLATES.map(({ id, labelTr, labelEn, descTr, descEn, months, workPackages }) =>
    ({ id, labelTr, labelEn, descTr, descEn, months, workPackages })));
});

app.use('/api/projects', projectsRouter);
app.use('/api/projects', generateRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/chatgpt', chatgptRouter);

app.use((err, req, res, next) => {
  console.error('Sunucu hatası:', err);
  res.status(500).json({ error: err.message || 'Bilinmeyen hata' });
});

app.listen(PORT, () => {
  console.log(`\n  TÜBİTAK 1831 sunucusu çalışıyor: http://localhost:${PORT}`);
  console.log(`  Motor: ChatGPT web (Playwright) — profil: ${fs.existsSync(CHATGPT.profileDir) ? 'var' : 'YOK (giriş gerekli)'}`);
  console.log(`  Google: ${GOOGLE.refreshToken ? 'hazır' : 'kurulmadı (npm run google:auth)'}`);
  console.log(`  OpenAI: ${OPENAI.apiKey ? 'hazır' : 'kurulmadı (OPENAI_API_KEY)'}`);
  console.log(`  Analiz içe aktarma: transkripsiyon=${IMPORT.transcriptionProvider}, form çıkarımı=${IMPORT.extractionProvider}`);
  console.log(`  İçe aktarma modeli: ${IMPORT.extractionProvider === 'ollama' ? IMPORT.ollamaModel : OPENAI.extractionModel}`);
  console.log(`  Vault: ${VAULT_PATH}\n`);
});

// Normal kapanışta tarayıcıyı kapat (orphan Chromium bırakma)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { try { await closeBrowser(); } catch { /* yok */ } process.exit(0); });
}
