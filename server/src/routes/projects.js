import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { Projects, Files, Sections } from '../db.js';
import { UPLOADS_DIR } from '../config.js';
import { getTemplate, DEFAULT_TEMPLATE_ID } from '../templates.js';

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
  const added = [];
  for (const file of req.files || []) {
    const id = nanoid(10);
    Files.add({
      id,
      projectId: project.id,
      originalName: file.originalname,
      storedPath: file.path,
      mimeType: file.mimetype
    });
    added.push({ id, original_name: file.originalname });
  }
  res.status(201).json({ files: added });
});

export default router;
