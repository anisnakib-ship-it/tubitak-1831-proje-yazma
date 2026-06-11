import { sendGmail, docUrl } from './google.js';
import { RECIPIENTS } from '../config.js';

const SECTION_TITLES = [
  'Proje Tanıtımı', 'Çağrı Uyumu', 'Problem Tanımı', 'Çözüm Önerileri',
  'Proje Hedefleri', 'Metodoloji', 'İş Planı', 'Proje Yönetimi',
  'Ar-Ge Kapasitesi', 'Proje Sonuçları', 'Beklenen Etki', 'Yaygın Etki',
  'Proje Sonrası Sürdürülebilirlik'
];

function nowStrings() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
}

export async function sendSuccessEmail(companyName, docId) {
  const url = docUrl(docId);
  const { date, time } = nowStrings();
  const subject = `TÜBİTAK 1831 Proje Başvurusu Hazırlandı - ${companyName}`;

  const rows = SECTION_TITLES.map(
    (t, i) => `<tr><td style="padding:7px 10px;border:1px solid #e8eaf6;color:#263238;">
      <span style="font-weight:700;color:#1a237e;margin-right:6px;">${i + 1}.</span>${t}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f2f5;margin:0;padding:0;color:#1a1a1a;">
  <div style="max-width:620px;margin:40px auto;background:#fff;border:1px solid #d0d5dd;">
    <div style="background:#1a237e;padding:32px 40px;border-bottom:4px solid #c62828;">
      <p style="color:#9fa8da;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 6px;">
        TÜBİTAK 1831 &mdash; Yeşil Dönüşüm Teknoloji Mentörlüğü Programı</p>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Proje Başvuru Taslağı Hazırlandı</h1>
    </div>
    <div style="padding:36px 40px;">
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">
        Sayın ilgili,<br><br><strong>${companyName}</strong> şirketi için TÜBİTAK 1831
        kapsamında hazırlanan proje başvuru taslağı tamamlanmıştır.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:9px 0;color:#5c6bc0;font-weight:600;width:160px;">Şirket</td><td><strong>${companyName}</strong></td></tr>
        <tr><td style="padding:9px 0;color:#5c6bc0;font-weight:600;">Oluşturulma</td><td>${date} ${time}</td></tr>
        <tr><td style="padding:9px 0;color:#5c6bc0;font-weight:600;">Durum</td><td>İncelemeye hazır</td></tr>
      </table>
      <a href="${url}" style="display:block;margin:28px 0;padding:14px 28px;background:#1a237e;color:#fff;text-decoration:none;font-size:14px;font-weight:700;text-align:center;">Proje Dokümanını Aç</a>
      <p style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#1a237e;border-bottom:1px solid #e0e0e0;padding-bottom:6px;">Hazırlanan Bölümler</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">${rows}</table>
      <div style="background:#fafafa;border-left:3px solid #546e7a;padding:14px 18px;margin-top:24px;font-size:13px;color:#37474f;line-height:1.6;">
        <strong>Önemli:</strong> Bu belge yapay zeka destekli sistem tarafından üretilmiştir.
        Teslim öncesi tüm bölümleri gözden geçirin ve TÜBİTAK format gereksinimlerini doğrulayın.
      </div>
    </div>
    <div style="background:#f7f8fa;padding:18px 40px;border-top:1px solid #e0e0e0;font-size:11px;color:#9e9e9e;">
      Bu ileti TÜBİTAK 1831 Proje Yazma sistemi tarafından otomatik oluşturulmuştur. · Sun &amp; Sun Danışmanlık
    </div>
  </div>
</body></html>`;

  const text = `TÜBİTAK 1831 - Proje Başvurusu Hazırlandı

Şirket: ${companyName}
Tarih: ${date} ${time}
Doküman: ${url}

ÖNEMLİ: Bu belge yapay zeka yardımıyla oluşturulmuştur. Teslim öncesi inceleyiniz.`;

  await sendGmail({ to: RECIPIENTS, subject, html, text });
}

export async function sendErrorEmail(companyName, error) {
  const { date, time } = nowStrings();
  const subject = `[HATA] TÜBİTAK 1831 Proje Otomasyonu - ${companyName}`;
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#c62828;padding:25px 30px;color:#fff;"><h1 style="margin:0;font-size:20px;">⚠️ Otomasyon Hatası</h1></div>
    <div style="padding:25px 30px;">
      <p>Proje üretimi sırasında bir hata oluştu.</p>
      <p><strong>Şirket:</strong> ${companyName}<br><strong>Tarih:</strong> ${date} ${time}</p>
      <div style="background:#ffebee;border-left:4px solid #c62828;padding:15px 20px;font-family:monospace;font-size:13px;color:#b71c1c;">${(error.message || String(error)).replace(/</g, '&lt;')}</div>
    </div>
  </div>
</body></html>`;
  const text = `TÜBİTAK 1831 - HATA\nŞirket: ${companyName}\nTarih: ${date} ${time}\n\n${error.message || error}`;
  await sendGmail({ to: RECIPIENTS, subject, html, text });
}
