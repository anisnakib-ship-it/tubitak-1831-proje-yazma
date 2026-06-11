import { google } from 'googleapis';
import { GOOGLE, RECIPIENTS } from '../config.js';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.send'
];

const OAUTH_REDIRECT = 'http://localhost:4477/oauth2callback';

/** OAuth2 istemcisi oluşturur (refresh token ile). */
export function makeOAuthClient(withRefreshToken = true) {
  if (!GOOGLE.clientId || !GOOGLE.clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET tanımlı değil (.env).');
  }
  const client = new google.auth.OAuth2(GOOGLE.clientId, GOOGLE.clientSecret, OAUTH_REDIRECT);
  if (withRefreshToken) {
    if (!GOOGLE.refreshToken) {
      throw new Error('GOOGLE_REFRESH_TOKEN tanımlı değil. "npm run google:auth" çalıştırın.');
    }
    client.setCredentials({ refresh_token: GOOGLE.refreshToken });
  }
  return client;
}

export { OAUTH_REDIRECT };

function clients() {
  const auth = makeOAuthClient();
  return {
    docs: google.docs({ version: 'v1', auth }),
    drive: google.drive({ version: 'v3', auth }),
    gmail: google.gmail({ version: 'v1', auth })
  };
}

const TRANSIENT = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Geçici ağ/DNS hatalarında yeniden dener. */
async function withRetry(fn, label = 'Google') {
  const delays = [1500, 3000, 6000, 10000];
  let lastErr;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = err.code || err.cause?.code || '';
      const transient = TRANSIENT.includes(code) || /getaddrinfo|network|socket hang up/i.test(err.message || '');
      if (!transient || attempt === delays.length) throw err;
      console.log(`${label}: geçici ağ hatası (${code || err.message}), yeniden deneniyor...`);
      await sleep(delays[attempt]);
    }
  }
  throw lastErr;
}

/**
 * Boş bir doküman oluşturur (şablon varsa kopyalar) ve ID döndürür.
 */
export async function createDocument(title) {
  const { drive } = clients();
  return withRetry(async () => {
    if (GOOGLE.templateDocId) {
      const copy = await drive.files.copy({ fileId: GOOGLE.templateDocId, requestBody: { name: title } });
      return copy.data.id;
    }
    const created = await drive.files.create({
      requestBody: { name: title, mimeType: 'application/vnd.google-apps.document' },
      fields: 'id'
    });
    return created.data.id;
  }, 'createDocument');
}

/** Dokümandaki mevcut tüm içeriği temizler (şablondan kopyalandıysa gerekli). */
export async function clearDocument(docId) {
  const { docs } = clients();
  const doc = await withRetry(() => docs.documents.get({ documentId: docId }), 'clearDocument.get');
  const content = doc.data.body?.content || [];
  const last = content[content.length - 1];
  const endIndex = last?.endIndex || 1;
  if (endIndex <= 2) return; // zaten boş
  await withRetry(() => docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } }] }
  }), 'clearDocument');
}

/** Hazırlanmış batchUpdate isteklerini uygular (gerekirse parçalara böler). */
export async function applyRequests(docId, requests) {
  const { docs } = clients();
  const CHUNK = 400;
  for (let i = 0; i < requests.length; i += CHUNK) {
    const slice = requests.slice(i, i + CHUNK);
    await withRetry(
      () => docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: slice } }),
      'applyRequests'
    );
  }
}

/** Dokümanı alıcılarla editör olarak paylaşır. */
export async function shareDocument(docId, emails = RECIPIENTS) {
  const { drive } = clients();
  const results = [];
  for (const email of emails) {
    try {
      await withRetry(() => drive.permissions.create({
        fileId: docId,
        sendNotificationEmail: false,
        requestBody: { type: 'user', role: 'writer', emailAddress: email }
      }), 'shareDocument');
      results.push({ email, ok: true });
    } catch (err) {
      results.push({ email, ok: false, error: err.message });
    }
  }
  return results;
}

/** Gmail ile HTML e-posta gönderir. */
export async function sendGmail({ to, subject, html, text }) {
  const { gmail } = clients();
  const boundary = 'b_' + Date.now();
  const headers = [
    `To: ${Array.isArray(to) ? to.join(', ') : to}`,
    'MIME-Version: 1.0',
    `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text || '', 'utf8').toString('base64'),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html || '', 'utf8').toString('base64'),
    `--${boundary}--`
  ];
  const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + body.join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await withRetry(() => gmail.users.messages.send({ userId: 'me', requestBody: { raw } }), 'sendGmail');
}

export function docUrl(docId) {
  return `https://docs.google.com/document/d/${docId}/edit`;
}

/** Bir dosyayı çöp kutusuna taşır (test temizliği için). */
export async function trashDocument(docId) {
  const { drive } = clients();
  await drive.files.update({ fileId: docId, requestBody: { trashed: true } });
}
