import { Router } from 'express';
import { Projects, Files, Sections } from '../db.js';
import { generateAnswers, buildProjectDoc } from '../services/generator.js';
import { sendSuccessEmail, sendErrorEmail } from '../services/email.js';
import { setProgress, getProgress, clearProgress } from '../progress.js';

const router = Router();

// Üretimi başlat (arka planda çalışır)
router.post('/:id/generate', (req, res) => {
  const project = Projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
  if (project.status === 'generating') {
    return res.status(409).json({ error: 'Bu proje için üretim zaten sürüyor.' });
  }

  const companyName = project.company_name || project.analysis?.companyName || project.name;
  if (!companyName) return res.status(400).json({ error: 'Şirket adı eksik.' });

  Projects.update(project.id, { status: 'generating', error_message: null });
  setProgress(project.id, { status: 'generating', step: 'start', message: 'Başlatılıyor...' });
  res.status(202).json({ status: 'generating' });

  // Arka plan görevi
  (async () => {
    try {
      const files = Files.listByProject(project.id);

      // 1) ChatGPT ile 13 bölümü üret ve HEMEN kaydet (doküman adımı başarısız olsa bile kaybolmaz)
      const { answers, template } = await generateAnswers({
        companyName,
        projectType: project.project_type,
        analysis: project.analysis || {},
        files,
        onProgress: (p) => setProgress(project.id, { status: 'generating', ...p })
      });
      Sections.replaceForProject(project.id, answers);

      // 2) Google Dokümanı oluştur
      const { docId, url } = await buildProjectDoc({
        companyName, template, answers,
        onProgress: (p) => setProgress(project.id, { status: 'generating', ...p })
      });

      Projects.update(project.id, { status: 'done', doc_url: url });
      setProgress(project.id, { status: 'done', step: 'done', message: 'Tamamlandı', url });

      try {
        setProgress(project.id, { status: 'done', step: 'email', message: 'E-posta gönderiliyor...', url });
        await sendSuccessEmail(companyName, docId);
      } catch (mailErr) {
        setProgress(project.id, { status: 'done', step: 'email-failed', message: 'E-posta gönderilemedi: ' + mailErr.message, url });
      }
    } catch (err) {
      Projects.update(project.id, { status: 'error', error_message: err.message });
      setProgress(project.id, { status: 'error', step: 'error', message: err.message });
      try { await sendErrorEmail(companyName, err); } catch { /* yok say */ }
    }
  })();
});

// İlerleme durumu (frontend bunu yoklar)
router.get('/:id/progress', (req, res) => {
  const project = Projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
  res.json({
    status: project.status,
    docUrl: project.doc_url,
    errorMessage: project.error_message,
    progress: getProgress(project.id)
  });
});

export default router;
