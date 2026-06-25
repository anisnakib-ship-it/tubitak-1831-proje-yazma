import fs from 'node:fs';
import { chromium } from 'playwright';
import { CHATGPT } from '../config.js';

/**
 * ChatGPT web arayüzünü Playwright ile süren "harness".
 *
 * - Kalıcı profil (server/data/chatgpt-profile) kullanır → bir kez giriş yapılır, oturum saklanır.
 * - Tek bir konuşma içinde: giriş mesajı (intro+kapsam+analiz) + 13 soru sırayla gönderilir.
 * - Yanıt akışı (streaming) bitene kadar beklenir, metin DOM'dan okunur.
 *
 * NOT: ChatGPT web arayüzünü otomatikleştirmek OpenAI kullanım koşullarına aykırıdır
 * ve arayüz değişirse seçiciler güncellenmelidir. Görünür (headed) tarayıcı gerekir.
 */

// DOM seçicileri — ChatGPT arayüzü değişirse burada güncelle.
const SEL = {
  composer: '#prompt-textarea',
  sendButton: '[data-testid="send-button"]',
  stopButton: '[data-testid="stop-button"]',
  assistantMsg: '[data-message-author-role="assistant"]',
  // Oturum süresi dolup anonim moda düşüldüğünde görünen "giriş yap" modalı
  noAuthModal: '#modal-no-auth-soft-rate-limit-inline-auth, [data-testid="modal-no-auth-soft-rate-limit-inline-auth"]'
};

let contextPromise = null;     // tek bir kalıcı bağlam
let queue = Promise.resolve(); // işlemleri sırala (tek tarayıcı)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Kalıcı tarayıcı bağlamını (gerekirse açarak) döndürür. */
async function getContext() {
  if (!contextPromise) {
    fs.mkdirSync(CHATGPT.profileDir, { recursive: true });
    const opts = {
      headless: CHATGPT.headless,
      viewport: { width: 1280, height: 900 },
      args: ['--disable-blink-features=AutomationControlled']
    };
    if (CHATGPT.channel) opts.channel = CHATGPT.channel;
    contextPromise = chromium.launchPersistentContext(CHATGPT.profileDir, opts).then(async (ctx) => {
      // Pano ile yapıştırma izinleri (prompt bütünlüğü için kullanılır — bkz. fillComposer)
      try {
        await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {
          origin: new URL(CHATGPT.baseUrl).origin
        });
      } catch { /* yok say */ }
      return ctx;
    });
  }
  return contextPromise;
}

/** Tarayıcıyı kapatır (oturum profile diskinde kalır). */
export async function closeBrowser() {
  if (contextPromise) {
    const ctx = await contextPromise;
    await ctx.close().catch(() => {});
    contextPromise = null;
  }
}

/** Bir sayfanın ChatGPT'ye giriş yapılmış durumda olup olmadığını kontrol eder. */
async function isLoggedIn(page, timeout = 8000) {
  try {
    await page.locator(SEL.composer).waitFor({ state: 'visible', timeout });
  } catch {
    return false;
  }
  // Compositör anonim kullanıcılarda da görünür; "no-auth" rate-limit modalı
  // varsa oturum aslında kapalı/süresi dolmuş demektir.
  const noAuthModal = page.locator(SEL.noAuthModal).first();
  if (await noAuthModal.isVisible().catch(() => false)) return false;
  return true;
}

/**
 * ChatGPT ana sayfasına gider; Cloudflare "Just a moment" geçişi ve sayfanın
 * yüklenmesi için bekler (gerekirse bir kez yeniler). Compositör görünürse true.
 */
async function gotoChat(page) {
  await page.goto(CHATGPT.baseUrl, { waitUntil: 'domcontentloaded', timeout: CHATGPT.navTimeoutMs });
  if (await isLoggedIn(page, 35000)) return true;
  // Cloudflare veya yavaş yükleme olabilir — bir kez yenile
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  return isLoggedIn(page, 35000);
}

/**
 * Giriş penceresini açar ve kullanıcı giriş yapana kadar (compositörü görene kadar) bekler.
 * Oturum kalıcı profile kaydedilir.
 * @param {number} waitMs giriş için beklenecek süre
 */
export async function openLoginWindow(waitMs = 300000) {
  const ctx = await getContext();
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(CHATGPT.baseUrl, { waitUntil: 'domcontentloaded', timeout: CHATGPT.navTimeoutMs });

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (await isLoggedIn(page)) return { ok: true, loggedIn: true };
    await sleep(2000);
  }
  return { ok: false, loggedIn: false, message: 'Giriş zaman aşımına uğradı.' };
}

/** Hızlı oturum kontrolü (profil var mı + sayfa açıp compositör görünüyor mu). */
export async function checkSession() {
  if (!fs.existsSync(CHATGPT.profileDir)) return { profileExists: false, loggedIn: false };
  return runQueued(async () => {
    const ctx = await getContext();
    const page = ctx.pages()[0] || (await ctx.newPage());
    const loggedIn = await gotoChat(page);
    return { profileExists: true, loggedIn };
  });
}

// Karşılaştırma imzası: harf+rakam dışındaki her şeyi (boşluk, satır sonu,
// markdown işaretleri) atar. Böylece prompt'un TAMAMININ kompozitöre ulaşıp
// ulaşmadığı (eksik/kesik gönderim) güvenilir biçimde doğrulanır; satır sonu
// gösterimi veya markdown işaret farkları yanlış hataya yol açmaz.
const sigForCompare = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Metni ChatGPT kompozitörüne (ProseMirror contenteditable) güvenilir biçimde yazar.
 *
 * NEDEN: `locator.fill()` çok satırlı içerikte satır sonlarını düşüreb, içeriği
 * eksik bırakabiliyordu → ChatGPT'ye bilgi tabanındakinden FARKLI bir prompt
 * gidiyordu. Burada önce pano ile yapıştırılır (yapı korunur), doğrulanır;
 * olmazsa satır satır yazılır. İçeriğin tamamı ulaşmazsa hata fırlatılır,
 * böylece sessizce eksik prompt gönderilmez.
 */
async function fillComposer(page, text) {
  const composer = page.locator(SEL.composer);
  const expected = sigForCompare(text);
  const verify = async () =>
    sigForCompare(await composer.innerText().catch(() => '')) === expected;

  const clearComposer = async () => {
    await composer.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
  };

  // 1) Pano ile yapıştır — ProseMirror satır sonlarını/yapıyı korur,
  //    yazma kurallarını (input rules) tetiklemez.
  try {
    await clearComposer();
    await page.evaluate((t) => navigator.clipboard.writeText(t), text);
    await composer.click();
    await page.keyboard.press('Control+V');
    await sleep(250);
    if (await verify()) return;
  } catch { /* yedek yönteme geç */ }

  // 2) Yedek: satır satır yaz (satır araları Shift+Enter ile korunur)
  await clearComposer();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await page.keyboard.press('Shift+Enter');
    if (lines[i]) await page.keyboard.type(lines[i]);
  }
  await sleep(250);
  if (await verify()) return;

  throw new Error('ChatGPT kompozitörüne prompt eksiksiz yazılamadı (bütünlük doğrulanamadı). Arayüz değişmiş olabilir.');
}

/** Compositöre metni güvenilir biçimde yazar ve gönderir. */
async function sendMessage(page, text) {
  // Oturum süresi dolup anonim moda düşüldüyse sessizce yanlış yere yazmak yerine net hata ver.
  const noAuthModal = page.locator(SEL.noAuthModal).first();
  if (await noAuthModal.isVisible().catch(() => false)) {
    throw new Error('ChatGPT oturumunun süresi doldu ve anonim moda düşüldü. Lütfen üst menüden "ChatGPT Giriş" ile yeniden giriş yapın.');
  }
  await fillComposer(page, text);
  await sleep(150);
  // Gönder düğmesi ya da Enter
  const send = page.locator(SEL.sendButton);
  if (await send.isVisible().catch(() => false)) await send.click();
  else await page.keyboard.press('Enter');
}

const MIN_ANSWER_LEN = 40;

/** Yanıt akışının bitmesini bekler ve son asistan mesajının metnini döndürür. */
async function waitForResponse(page, prevCount) {
  // Akış başladı: stop düğmesi görünür
  await page.locator(SEL.stopButton).waitFor({ state: 'visible', timeout: 45000 }).catch(() => {});
  // Akış bitti: stop düğmesi kayboldu
  await page.locator(SEL.stopButton).waitFor({ state: 'hidden', timeout: CHATGPT.responseTimeoutMs }).catch(() => {});

  // Yanıt kesildiyse "Continue generating" düğmesine bas (en fazla 3 kez)
  try {
    const cont = page.getByRole('button', { name: /continue generating|devam et|continue/i });
    for (let k = 0; k < 3 && (await cont.isVisible().catch(() => false)); k++) {
      await cont.click().catch(() => {});
      await page.locator(SEL.stopButton).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
      await page.locator(SEL.stopButton).waitFor({ state: 'hidden', timeout: CHATGPT.responseTimeoutMs }).catch(() => {});
    }
  } catch { /* yok say */ }

  // Metin sabitlenene kadar bekle (yedek mekanizma)
  const assistant = page.locator(SEL.assistantMsg);
  let last = '';
  for (let i = 0; i < 40; i++) {
    const count = await assistant.count();
    if (count > prevCount) {
      const txt = (await assistant.nth(count - 1).innerText().catch(() => '')) || '';
      if (txt && txt === last && txt.trim().length > 0) break;
      last = txt;
    }
    await sleep(1500);
  }
  return last.trim();
}

/** Bir mesaj gönderir ve yanıtı okur (tek deneme). */
async function askOnce(page, assistant, message) {
  const count = await assistant.count();
  await sendMessage(page, message);
  return waitForResponse(page, count);
}

/**
 * Bir soruyu gönderir; yanıt boş/çok kısa gelirse yeniden dener.
 * @param {number} retries ek deneme sayısı
 */
async function askWithRetry(page, assistant, message, { retries = 2, minLen = MIN_ANSWER_LEN, onRetry } = {}) {
  let last = '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const msg = attempt === 0
      ? message
      : `${message}\n\n(Not: Önceki yanıt boş veya eksik geldi. Lütfen bu bölümü baştan, eksiksiz ve Türkçe yaz.)`;
    last = await askOnce(page, assistant, msg);
    if (last && last.trim().length >= minLen) return last;
    if (onRetry) onRetry(attempt + 1);
    await sleep(1500);
  }
  return last;
}

/**
 * Tek bir ChatGPT konuşması yürütür.
 * @param {object} opts
 * @param {string} opts.introMessage  İlk mesaj (program+kapsam+analiz+talimat)
 * @param {Array<{number,title,prompt}>} opts.questions  13 soru
 * @param {function} opts.onProgress
 * @returns {Promise<Array<{number,title,content}>>}
 */
export function runConversation(opts) {
  return runQueued(() => _runConversation(opts));
}

async function _runConversation({ introMessage, questions, onProgress = () => {} }) {
  const ctx = await getContext();
  const page = ctx.pages()[0] || (await ctx.newPage());

  // Yeni boş sohbet (Cloudflare geçişine tolerans)
  if (!(await gotoChat(page))) {
    throw new Error('ChatGPT oturumu açık değil veya sayfa yüklenemedi. Tarayıcıda Cloudflare doğrulamasını tamamlayın ya da "ChatGPT Giriş" yapın.');
  }

  const assistant = page.locator(SEL.assistantMsg);

  // 1) Giriş mesajı (bağlam)
  onProgress({ step: 'context', message: 'ChatGPT: bağlam (intro + analiz) gönderiliyor...' });
  await askOnce(page, assistant, introMessage);

  // 2) 13 soru (boş/eksik yanıtta yeniden dener)
  const answers = [];
  for (const q of questions) {
    onProgress({ step: 'section', number: q.number, total: questions.length, title: q.title, message: `Bölüm ${q.number}: ${q.title}` });
    const content = await askWithRetry(page, assistant, q.prompt, {
      retries: 2,
      onRetry: (n) => onProgress({
        step: 'section', number: q.number, total: questions.length, title: q.title,
        message: `Bölüm ${q.number} yeniden deneniyor (${n})...`
      })
    });
    answers.push({ number: q.number, title: q.title, content });
    await sleep(800);
  }

  return answers;
}

/** Tek bir prompt gönderip yanıtı döndürür (bağlantı testi için). */
export function testPrompt(message) {
  return runQueued(async () => {
    const ctx = await getContext();
    const page = ctx.pages()[0] || (await ctx.newPage());
    if (!(await gotoChat(page))) throw new Error('ChatGPT oturumu açık değil veya sayfa yüklenemedi.');
    const assistant = page.locator(SEL.assistantMsg);
    const count = await assistant.count();
    await sendMessage(page, message);
    const reply = await waitForResponse(page, count);
    return reply;
  });
}

/** İşlemleri tek tarayıcıda sıraya alır. */
function runQueued(fn) {
  const run = queue.then(fn, fn);
  // Hata olsa da kuyruğun ilerlemesini sağla
  queue = run.then(() => {}, () => {});
  return run;
}
