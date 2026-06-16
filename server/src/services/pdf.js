import { unzlibSync, inflateSync } from 'fflate';

/**
 * Bir PDF tamponundan düz metin çıkarır — bağımlılıksız, en iyi çaba.
 *
 * Yaklaşım (docx.js ile aynı felsefe: fflate + elle ayrıştırma):
 *   1. PDF içindeki `stream … endstream` bloklarını byte düzeyinde bulur.
 *   2. FlateDecode (zlib) ile sıkıştırılmış içerik akışlarını açar; sıkıştırılmamış
 *      metin akışlarını olduğu gibi kullanır.
 *   3. Açılan içerik akışından metin gösterme operatörlerini (Tj, TJ, ', ")
 *      ayrıştırarak parantezli/heks dizeleri toplar; TJ dizilerindeki büyük
 *      negatif sayıları kelime boşluğu olarak yorumlar.
 *
 * SINIRLAMALAR:
 *   - Taranmış (görüntü) PDF'lerden metin çıkmaz — OCR yapılmaz.
 *   - Özel font kodlamaları bazı (özellikle Türkçe ş/ğ/İ vb.) karakterleri
 *     bozabilir; ASCII içerik güvenilir şekilde çıkar.
 *
 * @param {Buffer|Uint8Array} buffer
 * @returns {string} Düz metin
 */
export function parsePdf(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const parts = [];
  for (const content of extractContentStreams(bytes)) {
    const text = extractTextFromContent(latin1(content));
    if (text.trim()) parts.push(text);
  }
  return parts
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Uzantı .pdf mi? (içerik türü kontrolü çağıran tarafta) */
export function isPdf(filePathOrName) {
  return /\.pdf$/i.test(String(filePathOrName || ''));
}

// ---- byte düzeyi yardımcılar ------------------------------------------------

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const STREAM = ascii('stream');
const ENDSTREAM = ascii('endstream');

/** bytes içinde seq dizisinin `from`'dan itibaren ilk konumu (yoksa -1). */
function indexOfSeq(bytes, seq, from) {
  const last = bytes.length - seq.length;
  outer: for (let i = from; i <= last; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (bytes[i + j] !== seq[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Uint8Array → latin1 string (byte değeri = karakter kodu). */
function latin1(bytes) {
  return new TextDecoder('latin1').decode(bytes);
}

/** Bir içerik akışı görünüyor mu (metin operatörü içeriyor mu)? */
function looksLikeText(bytes) {
  return (
    indexOfSeq(bytes, ascii('Tj'), 0) !== -1 ||
    indexOfSeq(bytes, ascii('TJ'), 0) !== -1 ||
    indexOfSeq(bytes, ascii('BT'), 0) !== -1
  );
}

/** Bir akışı açmayı dener (zlib → ham deflate → sıkıştırılmamış). */
function inflateMaybe(slice) {
  try { return unzlibSync(slice); } catch { /* zlib değil */ }
  try { return inflateSync(slice); } catch { /* ham deflate değil */ }
  return looksLikeText(slice) ? slice : null; // sıkıştırılmamış içerik akışı
}

/** Tüm `stream … endstream` bloklarının açılmış içeriğini döndürür. */
function extractContentStreams(bytes) {
  const out = [];
  let from = 0;
  while (from < bytes.length) {
    const s = indexOfSeq(bytes, STREAM, from);
    if (s === -1) break;
    // 'endstream' içindeki 'stream' eşleşmesini atla (öncesi 'd' ise)
    if (s > 0 && bytes[s - 1] === 0x64) { from = s + STREAM.length; continue; }
    let dataStart = s + STREAM.length;
    if (bytes[dataStart] === 0x0d) dataStart++; // CR
    if (bytes[dataStart] === 0x0a) dataStart++; // LF
    const e = indexOfSeq(bytes, ENDSTREAM, dataStart);
    if (e === -1) break;
    let dataEnd = e;
    while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0a || bytes[dataEnd - 1] === 0x0d)) dataEnd--;
    const content = inflateMaybe(bytes.subarray(dataStart, dataEnd));
    if (content) out.push(content);
    from = e + ENDSTREAM.length;
  }
  return out;
}

// ---- içerik akışı (operatör) ayrıştırma -------------------------------------

const NUM_SPACE = 100; // TJ dizisinde bu eşiğin altındaki negatif sayı = kelime boşluğu

/** `(` konumundan başlayan PDF dize değişmezini çözer. */
function readLiteral(str, i) {
  let j = i + 1;
  let depth = 1;
  let res = '';
  const n = str.length;
  while (j < n && depth > 0) {
    const ch = str[j];
    if (ch === '\\') {
      const nx = str[j + 1];
      if (nx === undefined) { j++; break; }
      if (nx >= '0' && nx <= '7') {
        let oct = nx; let k = j + 2;
        for (let c = 0; c < 2 && str[k] >= '0' && str[k] <= '7'; c++, k++) oct += str[k];
        res += String.fromCharCode(parseInt(oct, 8) & 0xff);
        j = k; continue;
      }
      const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
      if (nx === '\n') { j += 2; continue; }                    // satır devamı
      if (nx === '\r') { j += str[j + 2] === '\n' ? 3 : 2; continue; }
      res += map[nx] !== undefined ? map[nx] : nx;
      j += 2; continue;
    }
    if (ch === '(') { depth++; res += '('; j++; continue; }
    if (ch === ')') { depth--; if (depth > 0) res += ')'; j++; continue; }
    res += ch; j++;
  }
  return { value: res, next: j };
}

/** `<` konumundan başlayan heks dizesini çözer. */
function readHex(str, i) {
  let j = i + 1;
  let hex = '';
  const n = str.length;
  while (j < n && str[j] !== '>') {
    if (/[0-9A-Fa-f]/.test(str[j])) hex += str[j];
    j++;
  }
  j++; // '>' atla
  if (hex.length % 2) hex += '0';
  let res = '';
  for (let k = 0; k < hex.length; k += 2) res += String.fromCharCode(parseInt(hex.substr(k, 2), 16));
  return { value: res, next: j };
}

/** `[` konumundan başlayan TJ dizisini metne çevirir (sayılar = boşluk). */
function readArray(str, i) {
  let j = i + 1;
  let res = '';
  const n = str.length;
  while (j < n && str[j] !== ']') {
    const ch = str[j];
    if (ch === '(') { const r = readLiteral(str, j); res += r.value; j = r.next; }
    else if (ch === '<') { const r = readHex(str, j); res += r.value; j = r.next; }
    else if (ch === '-' || ch === '.' || (ch >= '0' && ch <= '9')) {
      let num = '';
      while (j < n && /[-0-9.]/.test(str[j])) { num += str[j]; j++; }
      if (parseFloat(num) <= -NUM_SPACE) res += ' ';
    } else j++;
  }
  return { value: res, next: j + 1 };
}

/** Boşlukları atlayıp bir operatör jetonu okur ({op, next}). */
function peekOp(str, i) {
  let j = i;
  const n = str.length;
  while (j < n && /\s/.test(str[j])) j++;
  const c = str[j];
  if (c === "'" || c === '"') return { op: c, next: j + 1 };
  if (/[A-Za-z]/.test(c)) {
    let t = '';
    while (j < n && /[A-Za-z*]/.test(str[j])) { t += str[j]; j++; }
    return { op: t, next: j };
  }
  return { op: '', next: i };
}

/** Açılmış bir içerik akışından metni çıkarır. */
function extractTextFromContent(str) {
  let out = '';
  let i = 0;
  const n = str.length;
  while (i < n) {
    const c = str[i];
    if (c === '(') {
      const r = readLiteral(str, i);
      const p = peekOp(str, r.next);
      if (p.op === 'Tj' || p.op === "'" || p.op === '"') {
        if (p.op !== 'Tj') out += '\n';
        out += r.value + ' ';
        i = p.next;
      } else i = r.next; // metin operandı değil → yok say
    } else if (c === '[') {
      const r = readArray(str, i);
      const p = peekOp(str, r.next);
      if (p.op === 'TJ') { out += r.value + ' '; i = p.next; } else i = r.next;
    } else if (c === '<' && str[i + 1] === '<') {
      i += 2; // sözlük başlangıcı
    } else if (c === '<') {
      const r = readHex(str, i);
      const p = peekOp(str, r.next);
      if (p.op === 'Tj') { out += r.value + ' '; i = p.next; } else i = r.next;
    } else if (/[A-Za-z*]/.test(c)) {
      let t = '';
      while (i < n && /[A-Za-z*]/.test(str[i])) { t += str[i]; i++; }
      if (t === 'Td' || t === 'TD' || t === 'T*' || t === 'BT') out += '\n';
    } else i++;
  }
  return out;
}
