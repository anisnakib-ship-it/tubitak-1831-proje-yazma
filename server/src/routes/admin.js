import { Router } from 'express';
import { ADMIN_PASSWORD } from '../config.js';
import { Knowledge, exportKnowledge, importKnowledge } from '../services/knowledge.js';

/**
 * Bilgi Yönetimi (Knowledge admin) — platform içinden tüm prompt'ları,
 * program kapsamlarını, iş paketlerini, ortak kuralları ve bölüm uzunluklarını
 * düzenler. En son kazanır.
 *
 * Koruma: paylaşılan parola (server/.env → ADMIN_PASSWORD). İstemci parolayı
 * `x-admin-key` başlığında gönderir. Parola tanımlı değilse koruma kapalıdır
 * (yerel geliştirme). /admin herkese açık olduğundan üretimde MUTLAKA ayarlayın.
 */
const router = Router();

router.use((req, res, next) => {
  if (!ADMIN_PASSWORD) return next();                 // parola yoksa koruma kapalı
  if ((req.get('x-admin-key') || '') === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Yönetim parolası gerekli veya hatalı.' });
});

const wrap = (fn) => (req, res) => {
  try { fn(req, res); } catch (err) { res.status(400).json({ error: err.message }); }
};

// --- Programlar ---
router.get('/programs', wrap((req, res) => {
  res.json(Knowledge.listPrograms());
}));

router.get('/programs/:id', wrap((req, res) => {
  const program = Knowledge.getProgram(req.params.id);
  if (!program) return res.status(404).json({ error: 'Program bulunamadı' });
  res.json(program);
}));

router.put('/programs/:id', wrap((req, res) => {
  const program = Knowledge.updateProgram(req.params.id, req.body || {});
  if (!program) return res.status(404).json({ error: 'Program bulunamadı' });
  res.json(program);
}));

// --- Bölümler ---
router.put('/sections/:id', wrap((req, res) => {
  const section = Knowledge.updateSection(req.params.id, req.body || {});
  if (!section) return res.status(404).json({ error: 'Bölüm bulunamadı' });
  res.json(section);
}));

// --- Ortak kurallar ---
router.get('/global-rules', wrap((req, res) => {
  res.json(Knowledge.listGlobalRules());
}));

router.post('/global-rules', wrap((req, res) => {
  const { title } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Başlık gerekli' });
  res.status(201).json(Knowledge.createGlobalRule(req.body));
}));

router.put('/global-rules/:id', wrap((req, res) => {
  res.json(Knowledge.updateGlobalRule(req.params.id, req.body || {}));
}));

router.delete('/global-rules/:id', wrap((req, res) => {
  Knowledge.deleteGlobalRule(req.params.id);
  res.status(204).end();
}));

// --- Dışa / İçe aktar (JSON) ---
router.get('/export', wrap((req, res) => {
  const data = exportKnowledge();
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="bilgi-yedek-${stamp}.json"`);
  res.json(data);
}));

router.post('/import', wrap((req, res) => {
  importKnowledge(req.body);
  res.json({ ok: true, ...exportKnowledge() });
}));

export default router;
