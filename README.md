# TÜBİTAK 1831 Proje Yazma Web Uygulaması

Google Form yerine kullanılan, **Node.js + React** tabanlı yerel web uygulaması.
Bir proje açar ve **türünü seçersiniz** (Kurumsal Karbon / Ürün Karbon / Su
Verimliliği-Mavi Sertifika / Birleşik) → müşteri **analiz formunu** doldurursunuz →
bir **ChatGPT web otomasyon ajanı** (Playwright), **Obsidian bilgi grafiğindeki**
yazım kılavuzunu tek bir ChatGPT konuşmasında kullanarak 13 TÜBİTAK 1831 bölümünü
yazdırır → çıktı bir **Google Doküman** olarak oluşturulur ve **Gmail** ile ekibe gönderilir.

> **Üretim motoru:** Claude API yerine, kendi ChatGPT hesabınız Playwright ile
> sürülür. Bir kez giriş yaparsınız (oturum saklanır). Not: ChatGPT web arayüzünü
> otomatikleştirmek OpenAI kullanım koşullarına aykırıdır ve görünür bir tarayıcı gerektirir.

## Mimari

```
knowledge/   ← Obsidian vault (yazım kılavuzu — siz düzenlersiniz)
  00-index.md           13 soruyu kılavuz notlarına eşler ([[wikilink]])
  rules/                ton, değerlendirme kriterleri, biçimlendirme
  sections/             her bölüm için kılavuz notu (maxTokens frontmatter'da)
server/      ← Express backend (Claude anahtarını TUTAR; tarayıcıya gitmez)
  src/services/  knowledge, claude, google, docbuilder, generator, email
  data/          SQLite veritabanı + yüklenen dosyalar
web/         ← React (Vite) arayüz
```

## Kurulum

### 1. Bağımlılıkları yükleyin
```powershell
npm install                 # kök (concurrently)
npm run install:all         # server + web
npx playwright install chromium --prefix server   # ChatGPT otomasyonu için tarayıcı
```

### 2. Sunucu ayarları
`server/.env.example` dosyasını `server/.env` olarak kopyalayın ve doldurun:
```powershell
Copy-Item server/.env.example server/.env
```
- `CLAUDE_API_KEY` — Anthropic API anahtarınız
- `RECIPIENTS` — bildirim/paylaşım e-postaları (virgülle)
- `TEMPLATE_DOC_ID` — (opsiyonel) kopyalanacak şablon Google Doc ID'si

### 3. Google (Docs + Drive + Gmail) yetkisi — tek seferlik
1. https://console.cloud.google.com → yeni proje.
2. **APIs & Services > Enabled APIs** → şunları etkinleştirin: *Google Docs API*,
   *Google Drive API*, *Gmail API*.
3. **OAuth consent screen** → External, kendi e-postanızı "test user" ekleyin.
4. **Credentials > Create Credentials > OAuth client ID** → tür **Web application**,
   *Authorized redirect URI*: `http://localhost:4477/oauth2callback`.
5. Client ID ve Secret'ı `server/.env` içine yazın (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
6. Tek seferlik yetkilendirme:
   ```powershell
   npm run google:auth
   ```
   Açılan bağlantıda Google ile giriş yapın. Terminale yazılan
   `GOOGLE_REFRESH_TOKEN=...` değerini `server/.env` dosyasına ekleyin.

> Not: Doküman ve e-posta, yetki verdiğiniz Google hesabı adına oluşturulur.

### 4. ChatGPT girişi — tek seferlik
Görünür bir tarayıcı açıp ChatGPT'ye giriş yapın (oturum `server/data/chatgpt-profile`'a saklanır):
```powershell
npm run chatgpt:login --prefix server
```
veya uygulamayı başlattıktan sonra arayüzdeki **“ChatGPT Giriş”** düğmesini kullanın.
Cloudflare doğrulaması çıkarsa tarayıcıda kendiniz tamamlayın.

### 5. Çalıştırma
```powershell
npm run dev
```
- Arayüz: http://localhost:5173
- API:   http://localhost:4000

Üretim sırasında görünür bir Chromium penceresi açılır, ChatGPT'ye giriş mesajını ve
13 soruyu sırayla gönderir, yanıtları toplar. Pencereyi kapatmayın.

## Obsidian bilgi grafiğini düzenleme

`knowledge/` klasörünü **Obsidian'da vault olarak açın**. Yazım kurallarını
notlarda değiştirebilir, yeni `[[bağlantılar]]` ekleyebilirsiniz.
`00-index.md`, her sorunun hangi notları kullanacağını belirler — yapay zeka her
bölüm için **yalnızca** o bölüme bağlı notları + `Genel` notlarını okur.

Vault'un doğru okunduğunu kontrol etmek için: `GET http://localhost:4000/api/knowledge/health`

## Eski Google Apps Script'ten farklar
- "Prompt belgesi" yükleme kaldırıldı → 13 sorunun kuralları artık Obsidian vault'unda.
- "Analiz formu" dosyası → yapılandırılmış web formu (ek dosya yükleme korunur).
- Form tetikleyicisi → web arayüzü; projeler SQLite'ta saklanır ve tekrar açılabilir.
- Google erişimi Apps Script yerine `googleapis` + tek seferlik OAuth ile.
