import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { Projects, Files, Sections } from '../db.js';
import { UPLOADS_DIR } from '../config.js';
import { getTemplate, DEFAULT_TEMPLATE_ID } from '../templates.js';
import { transcriptFromInput, extractAnalysisFromTranscript, mergeAnalysis } from '../services/analysis-import.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, req.params.id, 'imports');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${nanoid(6)}${ext}`);
  }
});
const importUpload = multer({ storage: importStorage, limits: { fileSize: 25 * 1024 * 1024 } });

async function importAnalysisForProject({ project, file, transcript = '', mergeMode = 'fill-empty' }) {
  const source = await transcriptFromInput({ file, transcript });
  const { extracted, notes, evidence } = await extractAnalysisFromTranscript({
    projectType: project.project_type,
    transcript: source.transcript
  });
  const { analysis, filledKeys, skippedKeys } = mergeAnalysis({
    current: project.analysis || {},
    extracted,
    mode: mergeMode
  });

  const fields = { analysis };
  if (analysis.companyName) fields.company_name = analysis.companyName;
  const updated = Projects.update(project.id, fields);

  return {
    ...updated,
    import: {
      fileName: file?.originalname || '',
      transcribed: source.transcribed,
      truncated: source.truncated,
      transcriptChars: source.transcript.length,
      transcriptPreview: source.transcript.slice(0, 2000),
      extractedKeys: Object.keys(extracted),
      filledKeys,
      skippedKeys,
      evidence,
      notes,
      mergeMode
    }
  };
}

// Liste
router.get('/', (req, res) => {
  res.json(Projects.list());
});

// Oluştur
router.post('/', (req, res) => {
  const { name, companyName = '', projectType = DEFAULT_TEMPLATE_ID, analysis = {} } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Proje adı gerekli.' });
  const type = getTemplate(projectType) ? projectType : DEFAULT_TEMPLATE_ID;
  const id = nanoid(10);
  const project = Projects.create({ id, name: name.trim(), companyName, projectType: type, analysis });
  res.status(201).json(project);
});

// Tek proje (bölümler + dosyalar dahil)
router.get('/:id', (req, res) => {
  const project = Projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
  res.json({
    ...project,
    files: Files.listByProject(project.id),
    sections: Sections.listByProject(project.id)
  });
});

// Güncelle (analiz formu kaydetme)
router.put('/:id', (req, res) => {
  const project = Projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
  const { name, companyName, projectType, analysis } = req.body || {};
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (companyName !== undefined) fields.company_name = companyName;
  if (projectType !== undefined && getTemplate(projectType)) fields.project_type = projectType;
  if (analysis !== undefined) fields.analysis = analysis;
  res.json(Projects.update(project.id, fields));
});

// Görüşme ses kaydı / transkript dosyasından analiz formunu doldur
router.post('/:id/analysis/import', importUpload.single('file'), async (req, res, next) => {
  try {
    const project = Projects.get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

    const mergeMode = req.body?.mergeMode === 'overwrite' ? 'overwrite' : 'fill-empty';
    res.json(await importAnalysisForProject({
      project,
      file: req.file,
      transcript: req.body?.transcript || '',
      mergeMode
    }));
  } catch (err) {
    next(err);
  } finally {
    if (req.file?.path) {
      try { fs.rmSync(req.file.path, { force: true }); } catch { /* ignore cleanup */ }
    }
  }
});

// Uzun yapıştırılan transkriptlerden analiz formunu doldur (JSON gövde)
router.post('/:id/analysis/import-text', async (req, res, next) => {
  try {
    const project = Projects.get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

    const mergeMode = req.body?.mergeMode === 'overwrite' ? 'overwrite' : 'fill-empty';
    res.json(await importAnalysisForProject({
      project,
      transcript: req.body?.transcript || '',
      mergeMode
    }));
  } catch (err) {
    next(err);
  }
});

// Sil
router.delete('/:id', (req, res) => {
  const project = Projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
  Projects.remove(project.id);
  const dir = path.join(UPLOADS_DIR, project.id);
  fs.rmSync(dir, { recursive: true, force: true });
  res.json({ ok: true });
});

// Dosya yükle
router.post('/:id/files', upload.array('files', 10), (req, res) => {
  const project = Projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
  const kind = (req.body && req.body.kind) === 'workpackages' ? 'workpackages' : 'support';
  const added = [];
  for (const file of req.files || []) {
    const id = nanoid(10);
    Files.add({
      id,
      projectId: project.id,
      originalName: file.originalname,
      storedPath: file.path,
      mimeType: file.mimetype,
      kind
    });
    added.push({ id, original_name: file.originalname, kind });
  }
  res.status(201).json({ files: added });
});

export default router;
