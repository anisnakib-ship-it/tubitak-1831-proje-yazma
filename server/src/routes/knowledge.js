import { Router } from 'express';
import { knowledgeHealth } from '../services/knowledge.js';

const router = Router();

// Bilgi sağlık kontrolü — programlar/bölümler veritabanında dolu mu?
router.get('/health', (req, res) => {
  try {
    res.json(knowledgeHealth());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
