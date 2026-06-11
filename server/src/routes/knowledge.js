import { Router } from 'express';
import { vaultHealth } from '../services/knowledge.js';

const router = Router();

// Bilgi grafiği sağlık kontrolü — vault doğru kurulmuş mu?
router.get('/health', (req, res) => {
  try {
    res.json(vaultHealth());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
