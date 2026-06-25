import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { PORT, GOOGLE, CHATGPT, ADMIN_PASSWORD } from './config.js';
import './db.js'; // şemayı başlat
import { seedIfEmpty } from './services/knowledge.js';
import projectsRouter from './routes/projects.js';
import generateRouter from './routes/generate.js';
import knowledgeRouter from './routes/knowledge.js';
import adminRouter from './routes/admin.js';
import chatgptRouter from './routes/chatgpt.js';
import { closeBrowser } from './services/chatgpt-web.js';
import { getTemplates } from './templates.js';

// İlk açılış: bilgi tabloları boşsa tohum dosyasından doldur.
seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Sağlık / yapılandırma durumu
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    engine: 'chatgpt-web',
    chatgptProfile: fs.existsSync(CHATGPT.profileDir),
    googleConfigured: !!(GOOGLE.clientId && GOOGLE.clientSecret && GOOGLE.refreshToken)
  });
});

// Proje türleri (şablonlar) — veritabanından
app.get('/api/templates', (req, res) => {
  res.json(getTemplates().map(({ id, labelTr, labelEn, descTr, descEn, months, workPackages }) =>
    ({ id, labelTr, labelEn, descTr, descEn, months, workPackages })));
});

app.use('/api/projects', projectsRouter);
app.use('/api/projects', generateRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/admin', adminRouter);
app.use('/api/chatgpt', chatgptRouter);

app.use((err, req, res, next) => {
  console.error('Sunucu hatası:', err);
  res.status(500).json({ error: err.message || 'Bilinmeyen hata' });
});

app.listen(PORT, () => {
  console.log(`\n  TÜBİTAK 1831 sunucusu çalışıyor: http://localhost:${PORT}`);
  console.log(`  Motor: ChatGPT web (Playwright) — profil: ${fs.existsSync(CHATGPT.profileDir) ? 'var' : 'YOK (giriş gerekli)'}`);
  console.log(`  Google: ${GOOGLE.refreshToken ? 'hazır' : 'kurulmadı (npm run google:auth)'}`);
  console.log(`  Bilgi: veritabanı (Yönetim ekranından düzenlenir)`);
  console.log(`  /admin koruması: ${ADMIN_PASSWORD ? 'parola etkin' : '⚠ KAPALI (ADMIN_PASSWORD ayarlanmadı)'}\n`);
});

// Normal kapanışta tarayıcıyı kapat (orphan Chromium bırakma)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { try { await closeBrowser(); } catch { /* yok */ } process.exit(0); });
}
