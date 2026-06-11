/**
 * 13 bölümü, biçimlendirilmiş Google Docs batchUpdate isteklerine dönüştürür.
 * İleri yönde, çalışan bir indeks tutarak metin ekler ve stil uygular.
 */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    red: parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue: parseInt(h.slice(4, 6), 16) / 255
  };
}
const color = (hex) => ({ color: { rgbColor: hexToRgb(hex) } });
const pt = (n) => ({ magnitude: n, unit: 'PT' });

const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

export function buildDocRequests(companyName, dateStr, answers, typeLabel = '') {
  const requests = [];
  let index = 1;

  /** Bir paragraf metni ekler ve stillerini uygular. */
  function para(text, { align, heading, font = 'Arial', size = 11, bold = false, italic = false, fg = '#212121', before = 0, after = 8, indent = 0 } = {}) {
    const content = text + '\n';
    const start = index;
    const end = index + content.length;
    requests.push({ insertText: { location: { index: start }, text: content } });

    const paragraphStyle = {};
    const fields = [];
    if (align) { paragraphStyle.alignment = align; fields.push('alignment'); }
    if (heading) { paragraphStyle.namedStyleType = heading; fields.push('namedStyleType'); }
    paragraphStyle.spaceAbove = pt(before); fields.push('spaceAbove');
    paragraphStyle.spaceBelow = pt(after); fields.push('spaceBelow');
    if (indent) {
      paragraphStyle.indentStart = pt(indent); fields.push('indentStart');
    }
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle,
        fields: fields.join(',')
      }
    });

    // Metin stili yalnızca boş olmayan aralıklarda uygulanır (boş satırlar için aralık boş olur)
    if (end - 1 > start) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: {
            weightedFontFamily: { fontFamily: font },
            fontSize: pt(size),
            bold,
            italic,
            foregroundColor: color(fg)
          },
          fields: 'weightedFontFamily,fontSize,bold,italic,foregroundColor'
        }
      });
    }

    index = end;
  }

  function pageBreak() {
    requests.push({ insertPageBreak: { location: { index } } });
    index += 1;
  }

  const CENTER = 'CENTER';
  const LEFT = 'START';

  // ── KAPAK ────────────────────────────────────────────
  for (let i = 0; i < 5; i++) para('', { after: 0 });
  para('TÜBİTAK 1831', { align: CENTER, font: 'Arial', size: 32, bold: true, fg: '#1a237e', after: 6 });
  para('Yeşil Dönüşüm Teknoloji Mentörlüğü Programı', { align: CENTER, size: 14, italic: true, fg: '#3949ab', after: 40 });
  para(DIVIDER, { align: CENTER, size: 10, fg: '#1a237e', after: 36 });
  para(companyName, { align: CENTER, size: 26, bold: true, fg: '#c62828', after: 16 });
  para('PROJE BAŞVURU FORMU', { align: CENTER, size: 13, bold: true, fg: '#546e7a', after: 8 });
  if (typeLabel) para(typeLabel, { align: CENTER, size: 12, italic: true, fg: '#2f6b43', after: 36 });
  para(DIVIDER, { align: CENTER, size: 10, fg: '#1a237e', after: 24 });
  para(dateStr, { align: CENTER, size: 12, fg: '#78909c', after: 0 });
  pageBreak();

  // ── İÇİNDEKİLER ──────────────────────────────────────
  para('İÇİNDEKİLER', { heading: 'HEADING_1', size: 18, bold: true, fg: '#1a237e', after: 6 });
  para(DIVIDER, { size: 10, fg: '#1a237e', after: 24 });
  answers.forEach((a) => {
    para(`${a.number}.  ${a.title}`, { size: 12, fg: '#263238', after: 10, indent: 18 });
  });
  pageBreak();

  // ── BÖLÜMLER ─────────────────────────────────────────
  answers.forEach((a, i) => {
    para('BÖLÜM ' + String(a.number).padStart(2, '0'), { size: 10, bold: true, fg: '#90a4ae', before: 8, after: 4 });
    para(a.title.toUpperCase(), { heading: 'HEADING_1', size: 20, bold: true, fg: '#1a237e', after: 8 });
    para(DIVIDER, { size: 10, fg: '#1a237e', after: 20 });

    const lines = (a.content || '').split('\n');
    let blankRun = 0;
    for (const line of lines) {
      const t = line.trim();
      if (!t) {
        blankRun++;
        if (blankRun <= 1) para('', { after: 0 });
        continue;
      }
      blankRun = 0;

      if (/^#{1,3}\s/.test(t) || (t.startsWith('**') && t.endsWith('**') && t.length > 4)) {
        const clean = t.replace(/^#{1,3}\s+/, '').replace(/^\*\*|\*\*$/g, '');
        para(clean, { heading: 'HEADING_2', size: 12, bold: true, fg: '#283593', before: 14, after: 6 });
      } else if (/^[-•*]\s+/.test(t)) {
        const clean = stripInline(t.replace(/^[-•*]\s+/, ''));
        para('▸  ' + clean, { size: 11, fg: '#212121', indent: 24, after: 4 });
      } else if (/^\d+\.\s+/.test(t)) {
        const num = t.match(/^(\d+)\./)[1];
        const clean = stripInline(t.replace(/^\d+\.\s+/, ''));
        para(num + '.  ' + clean, { size: 11, fg: '#212121', indent: 24, after: 4 });
      } else {
        para(stripInline(t.replace(/^#+\s+/, '')), { size: 11, fg: '#212121', after: 8 });
      }
    }

    if (i < answers.length - 1) pageBreak();
  });

  // ── FOOTER ───────────────────────────────────────────
  para('', { after: 0 });
  para(DIVIDER, { align: CENTER, size: 10, fg: '#cfd8dc', after: 4 });
  para(`TÜBİTAK 1831 Proje Yazma Otomasyonu  ·  ${companyName}  ·  ${dateStr}`, {
    align: CENTER, size: 9, italic: true, fg: '#90a4ae', after: 0
  });

  return requests;
}

function stripInline(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
}
