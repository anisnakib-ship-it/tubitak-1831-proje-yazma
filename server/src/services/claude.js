import { CLAUDE } from '../config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Tek bir HTTP isteği — retry + backoff ile.
 * @private
 */
async function fetchClaude({ system, messages, maxTokens }) {
  if (!CLAUDE.apiKey) throw new Error('CLAUDE_API_KEY tanımlı değil (.env).');

  const payload = {
    model: CLAUDE.model,
    max_tokens: maxTokens || 4000,
    system,
    messages
  };

  const options = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': CLAUDE.apiKey,
      'anthropic-version': CLAUDE.apiVersion
    },
    body: JSON.stringify(payload)
  };

  const retryDelays = [2000, 5000, 10000];
  let response;
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      response = await fetch(CLAUDE.endpoint, options);
      break;
    } catch (err) {
      if (attempt < retryDelays.length) {
        await sleep(retryDelays[attempt]);
      } else {
        throw new Error('Claude API bağlantı hatası (3 denemede başarısız): ' + err.message);
      }
    }
  }

  const text = await response.text();
  if (response.status !== 200) {
    let msg = 'Claude API HTTP hatası: ' + response.status;
    try {
      const data = JSON.parse(text);
      if (data.error) msg += ' - ' + data.error.message;
    } catch {
      msg += ' - ' + text.slice(0, 300);
    }
    if (response.status === 401) throw new Error('API anahtarı geçersiz (CLAUDE_API_KEY).');
    if (response.status === 429) throw new Error('API hız sınırı aşıldı. Birkaç dakika sonra deneyin.');
    throw new Error(msg);
  }

  return JSON.parse(text);
}

/**
 * Claude'a çağrı yapar. Yanıt max_tokens ile kesilirse otomatik devam eder.
 *
 * @param {object} opts
 * @param {string|Array} opts.system  Sistem promptu (string veya cache'lenebilir blok dizisi)
 * @param {string} opts.user          Kullanıcı promptu
 * @param {number} opts.maxTokens
 * @returns {Promise<string>}         Birleştirilmiş tam metin
 */
export async function callClaude({ system, user, maxTokens }) {
  const MAX_CONTINUATIONS = 3;
  const messages = [{ role: 'user', content: user }];
  let full = '';

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const data = await fetchClaude({ system, messages, maxTokens });
    if (!data.content || data.content.length === 0) {
      throw new Error('Claude API boş yanıt döndürdü.');
    }
    const chunk = data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    full += chunk;

    if (data.stop_reason !== 'max_tokens') break;

    if (turn < MAX_CONTINUATIONS) {
      messages.push({ role: 'assistant', content: chunk });
      messages.push({
        role: 'user',
        content: 'Kaldığın yerden devam et. Başa dönme, sadece kaldığın cümleden devam et.'
      });
      await sleep(800);
    }
  }

  return full.trim();
}
