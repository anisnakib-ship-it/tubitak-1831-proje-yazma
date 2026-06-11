import { unzipSync, strFromU8 } from 'fflate';

/**
 * Bir .docx (veya benzeri OOXML) tamponundan düz metin çıkarır.
 * .docx aslında bir ZIP'tir; metin "word/document.xml" içindedir.
 *
 * @param {Buffer|Uint8Array} buffer
 * @returns {string} Düz metin (paragraf ve sekme sınırları korunur)
 */
export function parseDocx(buffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const entry = files['word/document.xml'];
  if (!entry) return '';
  let xml = strFromU8(entry);

  // Paragraf ve satır sonlarını gerçek satır sonlarına çevir
  xml = xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab\/?>/g, '\t')
    .replace(/<w:br\/?>/g, '\n');

  // Tüm XML etiketlerini kaldır
  let text = xml.replace(/<[^>]+>/g, '');

  // XML varlıklarını çöz
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

  // Fazla boş satırları sadeleştir
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** Uzantı .docx mı? */
export function isDocx(filePathOrName) {
  return /\.docx?$/i.test(filePathOrName);
}
