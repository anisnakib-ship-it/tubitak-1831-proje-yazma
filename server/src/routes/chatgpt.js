import { Router } from 'express';
import { openLoginWindow, checkSession, testPrompt } from '../services/chatgpt-web.js';

const router = Router();

let loginInFlight = false;

// Giriş penceresini aç (kullanıcı tarayıcıda ChatGPT'ye giriş yapar)
router.post('/login', async (req, res) => {
  if (loginInFlight) return res.status(409).json({ error: 'Giriş penceresi zaten açık.' });
  loginInFlight = true;
  try {
    const result = await openLoginWindow(300000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    loginInFlight = false;
  }
});

// Bağlantı testi — tek prompt gönder, yanıtı döndür
router.post('/test', async (req, res) => {
  const message = (req.body && req.body.message) ||
    "Lütfen yalnızca şu cümleyi aynen yaz: ChatGPT baglantisi calisiyor. Baska hicbir sey yazma.";
  try {
    const reply = await testPrompt(message);
    res.json({ ok: true, reply });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Oturum durumu
router.get('/session', async (req, res) => {
  try {
    res.json(await checkSession());
  } catch (err) {
    res.status(500).json({ error: err.message, profileExists: true, loggedIn: false });
  }
});

export default router;
