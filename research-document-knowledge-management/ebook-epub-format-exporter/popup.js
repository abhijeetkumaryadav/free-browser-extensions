/* PagePress — Article to EPUB Exporter
 * Extracts article text from the active tab, then builds a valid EPUB 3 file
 * using a tiny hand-written ZIP writer (entries stored uncompressed, so no
 * deflate dependency). Everything happens on-device. */

/* ---------- CRC32 (needed for stored ZIP entries) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- Minimal ZIP writer (stored entries only) ---------- */
function buildZip(files) {
  // files: [{name, data: Uint8Array}]
  const enc = new TextEncoder();
  const chunks = [];   // local file headers + data
  const central = [];   // central directory entries
  let offset = 0;

  const pushU16 = (arr, v) => arr.push(v & 0xFF, (v >>> 8) & 0xFF);
  const pushU32 = (arr, v) => arr.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF);

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const header = [];
    pushU32(header, 0x04034b50);      // local file header signature
    pushU16(header, 20);              // version needed
    pushU16(header, 0);               // flags
    pushU16(header, 0);               // method: stored
    pushU16(header, 0); pushU16(header, 0); // time/date
    pushU32(header, crc);
    pushU32(header, f.data.length);
    pushU32(header, f.data.length);
    pushU16(header, nameBytes.length);
    pushU16(header, 0);               // extra length

    const entry = [...header, ...nameBytes, ...f.data];
    const cen = [];
    pushU32(cen, 0x02014b50);         // central directory signature
    pushU16(cen, 20); pushU16(cen, 20);
    pushU16(cen, 0); pushU16(cen, 0);
    pushU16(cen, 0); pushU16(cen, 0);
    pushU32(cen, crc);
    pushU32(cen, f.data.length); pushU32(cen, f.data.length);
    pushU16(cen, nameBytes.length);
    pushU16(cen, 0); pushU16(cen, 0); pushU16(cen, 0); pushU16(cen, 0);
    pushU32(cen, 0);                  // external attrs
    pushU32(cen, offset);             // local header offset
    central.push(...cen, ...nameBytes);

    chunks.push(...entry);
    offset += entry.length;
  }

  const centralOffset = offset;
  const centralBytes = central.length;
  const end = [];
  pushU32(end, 0x06054b50);           // end of central directory
  pushU16(end, 0); pushU16(end, 0);
  pushU16(end, files.length); pushU16(end, files.length);
  pushU32(end, centralBytes);
  pushU32(end, centralOffset);
  pushU16(end, 0);

  return new Uint8Array([...chunks, ...central, ...end]);
}

/* ---------- EPUB builder ---------- */
function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildEpub(title, author, blocks) {
  const enc = new TextEncoder();
  const bookId = 'pagepress-' + Date.now().toString(36);
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  const bodyHtml = blocks.map(b => {
    if (b.type === 'h') return `    <h2>${escapeXml(b.text)}</h2>`;
    return `    <p>${escapeXml(b.text)}</p>`;
  }).join('\n');

  const contentXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(title)}</title>
<style>body{font-family:serif;line-height:1.6}h2{margin-top:1.5em}</style></head>
<body>
  <h1>${escapeXml(title)}</h1>
${bodyHtml}
</body>
</html>`;

  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="content"/></spine>
</package>`;

  const containerXml = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

  // mimetype must be the FIRST entry and stored uncompressed
  return buildZip([
    { name: 'mimetype', data: enc.encode('application/epub+zip') },
    { name: 'META-INF/container.xml', data: enc.encode(containerXml) },
    { name: 'OEBPS/content.opf', data: enc.encode(contentOpf) },
    { name: 'OEBPS/content.xhtml', data: enc.encode(contentXhtml) }
  ]);
}

/* ---------- Page extraction (runs in the page, so must be self-contained) ---------- */
function extractFromPage(source) {
  if (source === 'selection') {
    const sel = window.getSelection().toString().trim();
    if (!sel) return { ok: false, error: 'No text is selected on this page.' };
    return { ok: true, blocks: sel.split(/\n\s*\n/).filter(Boolean).map(t => ({ type: 'p', text: t.trim() })), title: document.title };
  }
  // Article heuristic: prefer semantic containers, else the text-richest block
  const candidates = [...document.querySelectorAll('article, main, [role="main"]')];
  let root = candidates.find(el => el.innerText && el.innerText.trim().length > 200);
  if (!root) {
    let best = null, bestLen = 0;
    for (const el of document.querySelectorAll('div, section')) {
      const len = (el.innerText || '').trim().length;
      if (len > bestLen && len < 200000) { bestLen = len; best = el; }
    }
    root = best || document.body;
  }
  const blocks = [];
  for (const el of root.querySelectorAll('h1,h2,h3,p,li')) {
    const text = (el.innerText || '').trim().replace(/\s+/g, ' ');
    if (text.length < 20 || /^(cookie|subscribe|newsletter|advertisement)/i.test(text)) continue;
    // Skip nested duplicates: only leaf-ish elements
    if (el.querySelector('p, h1, h2, h3')) continue;
    blocks.push({ type: /^h/i.test(el.tagName) ? 'h' : 'p', text });
    if (blocks.length >= 400) break;
  }
  if (!blocks.length) return { ok: false, error: 'Could not find article text on this page. Try selecting text instead.' };
  return { ok: true, blocks, title: document.title };
}

/* ---------- Popup wiring ---------- */
const $ = id => document.getElementById(id);
let source = 'article';
let extracted = null;

document.querySelectorAll('.seg').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    source = btn.dataset.source;
    $('source-hint').textContent = source === 'article'
      ? "Extracts the page's main article body (headings + paragraphs), boilerplate removed."
      : 'Uses the text you have selected on the page. Select text first, then extract.';
    extracted = null;
    resetPreview();
  });
});

function resetPreview() {
  $('preview-empty').classList.remove('hidden');
  $('preview-stats').classList.add('hidden');
  $('excerpt').textContent = '';
  $('btn-export').disabled = true;
}

function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

$('btn-extract').addEventListener('click', async () => {
  setStatus('Extracting…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractFromPage,
      args: [source]
    });
    if (!result || !result.ok) throw new Error((result && result.error) || 'Extraction failed.');
    extracted = result;
    const words = result.blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0);
    $('stat-words').textContent = words.toLocaleString();
    $('stat-blocks').textContent = result.blocks.length;
    $('stat-pages').textContent = Math.max(1, Math.round(words / 300));
    $('excerpt').textContent = '“' + result.blocks[0].text.slice(0, 160) + '…”';
    $('preview-empty').classList.add('hidden');
    $('preview-stats').classList.remove('hidden');
    if (!$('book-title').value) $('book-title').value = (result.title || 'Untitled article').slice(0, 120);
    $('btn-export').disabled = false;
    setStatus('Content extracted — ready to export.');
    chrome.storage.local.set({ ppTitle: $('book-title').value, ppAuthor: $('book-author').value });
  } catch (e) {
    setStatus(e.message || 'Extraction failed on this page.', true);
  }
});

$('btn-export').addEventListener('click', async () => {
  if (!extracted) return;
  setStatus('Building EPUB…');
  try {
    const title = $('book-title').value.trim() || 'Untitled article';
    const author = $('book-author').value.trim() || 'Unknown author';
    const epubBytes = buildEpub(title, author, extracted.blocks);
    const blob = new Blob([epubBytes], { type: 'application/epub+zip' });
    const url = URL.createObjectURL(blob);
    const safeName = title.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'article';
    await chrome.downloads.download({ url, filename: safeName + '.epub', saveAs: true });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    chrome.storage.local.set({ ppTitle: title, ppAuthor: author });
    setStatus('EPUB downloaded.');
  } catch (e) {
    setStatus('Export failed: ' + (e.message || e), true);
  }
});

// Restore remembered details
chrome.storage.local.get(['ppTitle', 'ppAuthor'], r => {
  if (r.ppTitle) $('book-title').placeholder = r.ppTitle;
  if (r.ppAuthor) $('book-author').value = r.ppAuthor;
});
