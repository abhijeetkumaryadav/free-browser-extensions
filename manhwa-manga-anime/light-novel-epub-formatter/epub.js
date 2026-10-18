/* NovelPress — EPUB builder (pure module, no DOM / no chrome.* references)
   Hand-written stored-entry ZIP writer (mimetype first, uncompressed) plus
   EPUB 2 package documents (container.xml, content.opf, toc.ncx, XHTML chapters).
   Safe to require() in Node for testing: exposes module.exports when available. */

'use strict';

/* --- CRC-32 (IEEE 802.3) -------------------------------------------------- */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* --- XML escaping ---------------------------------------------------------- */
function escXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* --- Text -> paragraphs ---------------------------------------------------- */
/* Blank-line separated blocks become <p>; single newlines inside a block
   become <br/>. Leading/trailing whitespace trimmed. */
function textToParagraphs(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .join('\n')
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(block => block.length > 0)
    .map(block => '<p>' + escXml(block).replace(/\n/g, '<br/>') + '</p>')
    .join('\n');
}

/* --- Stored (uncompressed) ZIP -------------------------------------------- */
function buildStoredZip(files) {
  // files: [{ name: string, data: Uint8Array }]; returns Uint8Array of the ZIP.
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const push = (buf) => { chunks.push(buf); offset += buf.length; };

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
    const crc = crc32(data);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);   // local file header signature
    lh.setUint16(4, 20, true);           // version needed to extract
    lh.setUint16(6, 0x0800, true);       // flags: UTF-8 filenames
    lh.setUint16(8, 0, true);            // method: stored
    lh.setUint16(10, 0, true);           // mod time
    lh.setUint16(12, 0, true);           // mod date
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); // compressed size (= stored)
    lh.setUint32(22, data.length, true); // uncompressed size
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);           // extra field length

    push(new Uint8Array(lh.buffer));
    push(nameBytes);
    push(data);

    central.push({ nameBytes, crc, size: data.length, offset: offset - (30 + nameBytes.length + data.length) });
  }

  const cdStart = offset;
  for (const c of central) {
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);   // central directory signature
    ch.setUint16(4, 20, true);           // version made by
    ch.setUint16(6, 20, true);           // version needed
    ch.setUint16(8, 0x0800, true);       // flags: UTF-8
    ch.setUint16(10, 0, true);           // method: stored
    ch.setUint16(12, 0, true);
    ch.setUint16(14, 0, true);
    ch.setUint32(16, c.crc, true);
    ch.setUint32(20, c.size, true);
    ch.setUint32(24, c.size, true);
    ch.setUint16(28, c.nameBytes.length, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true);           // external attributes
    ch.setUint32(42, c.offset, true);    // local header offset
    push(new Uint8Array(ch.buffer));
    push(c.nameBytes);
  }
  const cdSize = offset - cdStart;

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);   // end of central directory
  eocd.setUint16(8, central.length, true);
  eocd.setUint16(10, central.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, cdStart, true);
  eocd.setUint16(20, 0, true);           // comment length
  push(new Uint8Array(eocd.buffer));

  const out = new Uint8Array(offset);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

/* --- EPUB documents -------------------------------------------------------- */
function chapterXhtml(title, text) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE html>\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml">\n' +
    '<head><title>' + escXml(title) + '</title>' +
    '<style>body{font-family:serif;line-height:1.6;margin:5%}h2{text-align:center}</style></head>\n' +
    '<body>\n<h2>' + escXml(title) + '</h2>\n' +
    textToParagraphs(text) + '\n' +
    '</body>\n</html>\n';
}

function containerXml() {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
    '  <rootfiles>\n' +
    '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n' +
    '  </rootfiles>\n' +
    '</container>\n';
}

function contentOpf({ title, author, uuid, chapters }) {
  const manifestItems = chapters.map((c, i) =>
    '    <item id="ch' + (i + 1) + '" href="chapter' + (i + 1) + '.xhtml" media-type="application/xhtml+xml"/>'
  ).join('\n');
  const spineItems = chapters.map((_, i) =>
    '    <itemref idref="ch' + (i + 1) + '"/>'
  ).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">\n' +
    '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
    '    <dc:title>' + escXml(title) + '</dc:title>\n' +
    '    <dc:creator>' + escXml(author) + '</dc:creator>\n' +
    '    <dc:language>en</dc:language>\n' +
    '    <dc:identifier id="bookid">urn:uuid:' + escXml(uuid) + '</dc:identifier>\n' +
    '  </metadata>\n' +
    '  <manifest>\n' +
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n' +
    manifestItems + '\n' +
    '  </manifest>\n' +
    '  <spine toc="ncx">\n' +
    spineItems + '\n' +
    '  </spine>\n' +
    '  <guide>\n' +
    '    <reference type="text" title="Start" href="chapter1.xhtml"/>\n' +
    '  </guide>\n' +
    '</package>\n';
}

function tocNcx({ title, uuid, chapters }) {
  const navPoints = chapters.map((c, i) =>
    '    <navPoint id="nav' + (i + 1) + '" playOrder="' + (i + 1) + '">' +
    '<navLabel><text>' + escXml(c.title) + '</text></navLabel>' +
    '<content src="chapter' + (i + 1) + '.xhtml"/></navPoint>'
  ).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n' +
    '<head><meta name="dtb:uid" content="urn:uuid:' + escXml(uuid) + '"/></head>\n' +
    '<docTitle><text>' + escXml(title) + '</text></docTitle>\n' +
    '<navMap>\n' + navPoints + '\n</navMap>\n' +
    '</ncx>\n';
}

function makeUuid() {
  // RFC 4122 v4 UUID from crypto randomness; falls back to Math.random.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) +
         '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}

/* --- Public: build an EPUB -------------------------------------------------- */
/* chapters: [{ title, text }]. Throws on empty input. Returns Uint8Array. */
function buildEpub({ title, author, chapters }) {
  const cleanChapters = (chapters || [])
    .filter(c => c && (String(c.title || '').trim() || String(c.text || '').trim()))
    .map(c => ({ title: String(c.title || 'Untitled').trim() || 'Untitled', text: String(c.text || '') }));
  if (cleanChapters.length === 0) throw new Error('Add at least one chapter with text.');

  const bookTitle = String(title || '').trim() || 'Untitled Novel';
  const bookAuthor = String(author || '').trim() || 'Unknown Author';
  const uuid = makeUuid();
  const enc = new TextEncoder();
  const str = (s) => enc.encode(s);

  const files = [
    { name: 'mimetype', data: str('application/epub+zip') }, // must be first, stored
    { name: 'META-INF/container.xml', data: str(containerXml()) },
    { name: 'OEBPS/content.opf', data: str(contentOpf({ title: bookTitle, author: bookAuthor, uuid, chapters: cleanChapters })) },
    { name: 'OEBPS/toc.ncx', data: str(tocNcx({ title: bookTitle, uuid, chapters: cleanChapters })) }
  ];
  cleanChapters.forEach((c, i) => {
    files.push({ name: 'OEBPS/chapter' + (i + 1) + '.xhtml', data: str(chapterXhtml(c.title, c.text)) });
  });

  return buildStoredZip(files);
}

function wordCount(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  return words.length === 1 && words[0] === '' ? 0 : words.length;
}

// Export for Node testing; harmless in the browser.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildEpub, buildStoredZip, crc32, escXml, textToParagraphs, wordCount };
}
