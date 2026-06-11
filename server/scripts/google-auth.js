/**
 * Tek seferlik Google OAuth kurulumu.
 *
 * Çalıştırma:  npm run google:auth   (proje kökünden)
 *
 * Tarayıcıda Google ile giriş yaparsınız; betik bir "refresh token" alır
 * ve ekrana yazar. Bu değeri server/.env içindeki GOOGLE_REFRESH_TOKEN'a
 * yapıştırın. Uygulama bundan sonra giriş istemeden çalışır.
 *
 * ÖN KOŞUL: server/.env içinde GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET dolu olmalı
 * (Google Cloud Console > OAuth 2.0 Client, tür: "Web application",
 *  Authorized redirect URI: http://localhost:4477/oauth2callback).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeOAuthClient, GOOGLE_SCOPES, OAUTH_REDIRECT } from '../src/services/google.js';

const ENV_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');

/** GOOGLE_REFRESH_TOKEN değerini server/.env içine yazar/günceller. */
function writeRefreshToken(token) {
  let text = '';
  try { text = fs.readFileSync(ENV_PATH, 'utf8'); } catch { /* yok */ }
  if (/^GOOGLE_REFRESH_TOKEN=.*$/m.test(text)) {
    text = text.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${token}`);
  } else {
    text += `\nGOOGLE_REFRESH_TOKEN=${token}\n`;
  }
  fs.writeFileSync(ENV_PATH, text, 'utf8');
}

const client = makeOAuthClient(false);

const authUrl = client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: GOOGLE_SCOPES
});

console.log('\n1) Şu adresi tarayıcıda açın ve Google ile giriş yapın:\n');
console.log('   ' + authUrl + '\n');
console.log('2) Giriş sonrası bu betik token\'ı otomatik alıp gösterecek...\n');

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) {
    res.writeHead(404).end();
    return;
  }
  const url = new URL(req.url, 'http://localhost:4477');
  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('Kod bulunamadı.');
    return;
  }
  try {
    const { tokens } = await client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Başarılı!</h2><p>Bu pencereyi kapatabilirsiniz. Token terminalde gösterildi.</p>');

    console.log('\n=== BAŞARILI ===');
    if (tokens.refresh_token) {
      writeRefreshToken(tokens.refresh_token);
      console.log('\n✓ GOOGLE_REFRESH_TOKEN otomatik olarak server/.env dosyasına yazıldı.');
      console.log('  Sunucuyu yeniden başlatın; Google hazır olacak.\n');
    } else {
      console.log('\nUYARI: refresh_token gelmedi. Google hesabınızdan uygulamanın');
      console.log('erişimini kaldırıp tekrar deneyin (prompt=consent gerekli).\n');
    }
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500).end('Hata: ' + err.message);
    console.error('Token alınamadı:', err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(4477, () => {
  console.log('(Yerel dinleyici hazır: ' + OAUTH_REDIRECT + ')');
});
