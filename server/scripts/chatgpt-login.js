/**
 * ChatGPT'ye tek seferlik giriş.
 *
 * Çalıştırma:  npm run chatgpt:login   (server klasöründen)
 *
 * Görünür bir tarayıcı açılır; ChatGPT'ye kendiniz giriş yaparsınız.
 * Oturum kalıcı profile kaydedilir; uygulama sonraki üretimlerde bu oturumu kullanır.
 */
import { openLoginWindow, closeBrowser } from '../src/services/chatgpt-web.js';

console.log('\nTarayıcı açılıyor... ChatGPT\'ye giriş yapın. Giriş algılanınca pencere kapanacak.\n');
const result = await openLoginWindow(300000);
if (result.loggedIn) console.log('✓ Giriş başarılı. Oturum kaydedildi.\n');
else console.log('✗ Giriş algılanamadı: ' + (result.message || '') + '\n');
await closeBrowser();
process.exit(result.loggedIn ? 0 : 1);
