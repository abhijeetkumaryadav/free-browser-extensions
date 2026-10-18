/* Article to EPUB — engine: extraction + EPUB assembly (testable, no DOM/chrome here) */
// ENGINE-START
"use strict";

// ---- Text extraction heuristics -------------------------------------------
// Finds the best article container: prefers <article>, then <main>, then the
// element with the largest visible text, skipping nav/header/footer/aside.
const SKIP_TAGS = new Set(["NAV", "HEADER", "FOOTER", "ASIDE", "SCRIPT", "STYLE", "NOSCRIPT", "FORM", "IFRAME"]);

// Score a DOM-like node descriptor {tag, text, childCount} for article-likeness.
function scoreCandidate(tag, textLen) {
  let s = Math.min(textLen, 3000); // cap so giants don't outrank semantic tags
  if (tag === "ARTICLE") s += 1500;
  if (tag === "MAIN") s += 1000;
  return s;
}

// Pick best container from a list of {tag, textLen} descriptors.
function pickBestContainer(candidates) {
  let best = null;
  for (const c of candidates) {
    if (SKIP_TAGS.has(c.tag)) continue;
    if (c.textLen < 200) continue;
    if (!best || scoreCandidate(c.tag, c.textLen) > scoreCandidate(best.tag, best.textLen)) best = c;
  }
  return best;
}

// Split text into paragraphs (blank-line or long-line separated).
function splitParagraphs(text) {
  return text.split(/\n{2,}|\r{2,}/).map(p => p.replace(/\s+/g, " ").trim()).filter(p => p.length > 20);
}

// ---- EPUB assembly (pure string building) ---------------------------------
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fileNameFromTitle(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return (slug || "article") + ".epub";
}

const MIME_TYPE = "application/epub+zip";

function containerXml() {
  return '<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
    '\n  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>' +
    '</rootfiles>\n</container>';
}

function chapterXhtml(title, paragraphs) {
  const ps = paragraphs.map(p => "    <p>" + escapeXml(p) + "</p>").join("\n");
  return '<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head><title>' +
    escapeXml(title) + "</title></head>\n<body>\n  <h1>" + escapeXml(title) + "</h1>\n" + ps + "\n</body>\n</html>";
}

function contentOpf(title) {
  const now = new Date().toISOString();
  return '<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid" version="2.0">' +
    '\n<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '\n  <dc:title>' + escapeXml(title) + "</dc:title>" +
    '\n  <dc:creator>Exported by Article to EPUB</dc:creator>' +
    '\n  <dc:language>en</dc:language>' +
    '\n  <dc:identifier id="uid">article-' + escapeXml(now) + "</dc:identifier>" +
    '\n  <dc:date>' + escapeXml(now) + "</dc:date>" +
    "\n</metadata>" +
    '\n<manifest><item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest>' +
    '\n<spine toc="ncx"><itemref idref="ch1"/></spine>' +
    "\n</package>";
}

function tocNcx(title) {
  return '<?xml version="1.0" encoding="utf-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">' +
    "\n<head><meta name=\"dtb:uid\" content=\"article\"/></head>" +
    '\n<docTitle><text>' + escapeXml(title) + "</text></docTitle>" +
    '\n<navMap><navPoint id="np1" playOrder="1"><navLabel><text>' + escapeXml(title) +
    '</text></navLabel><content src="chapter1.xhtml"/></navPoint></navMap>\n</ncx>';
}

// All parts of the minimal EPUB; the popup writes them into a ZIP blob.
function epubParts(title, paragraphs) {
  return [
    { path: "mimetype", content: MIME_TYPE, stored: true },
    { path: "META-INF/container.xml", content: containerXml(), stored: false },
    { path: "OEBPS/chapter1.xhtml", content: chapterXhtml(title, paragraphs), stored: false },
    { path: "OEBPS/content.opf", content: contentOpf(title), stored: false },
    { path: "OEBPS/toc.ncx", content: tocNcx(title), stored: false }
  ];
}

// ENGINE-END
/* global chrome, JSZip */
// Note: we vendor a minimal ZIP writer below (no remote libraries allowed).

document.addEventListener("DOMContentLoaded", () => {
  const exportBtn = document.getElementById("exportBtn");
  const titleEl = document.getElementById("articleTitle");
  const statusEl = document.getElementById("status");
  const noticeEl = document.getElementById("notice");

  exportBtn.addEventListener("click", () => {
    statusEl.textContent = "Reading page…";
    noticeEl.textContent = "";
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) { noticeEl.textContent = "No active tab available."; return; }
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractArticle
      }, (results) => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "";
          noticeEl.textContent = "Cannot read this page (browser page or restricted tab).";
          return;
        }
        const data = results && results[0] && results[0].result;
        if (!data || !data.paragraphs || data.paragraphs.length === 0) {
          statusEl.textContent = "";
          noticeEl.textContent = "Could not find enough article text on this page.";
          return;
        }
        statusEl.textContent = "Building EPUB (" + data.paragraphs.length + " paragraphs)…";
        try {
          const parts = epubParts(data.title, data.paragraphs);
          const blob = buildZipBlob(parts);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileNameFromTitle(data.title);
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          statusEl.textContent = "Saved: " + fileNameFromTitle(data.title);
          titleEl.textContent = data.title;
        } catch (e) {
          statusEl.textContent = "";
          noticeEl.textContent = "Failed to build the EPUB file.";
        }
      });
    });
  });
});

// Injected into the page: heuristic article extraction. Returns {title, paragraphs}.
function extractArticle() {
  const SKIP = ["NAV", "HEADER", "FOOTER", "ASIDE", "SCRIPT", "STYLE", "NOSCRIPT", "FORM", "IFRAME"];
  const title = (document.querySelector('meta[property="og:title"]') || {}).content ||
    document.title || "Untitled article";
  let best = null, bestText = "";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let el;
  while ((el = walker.nextNode())) {
    if (SKIP.indexOf(el.tagName) !== -1) continue;
    if (el.tagName !== "ARTICLE" && el.tagName !== "MAIN" && el.tagName !== "DIV" && el.tagName !== "SECTION") continue;
    const text = (el.innerText || "").trim();
    if (text.length < 200) continue;
    if (!best || text.length > bestText.length) { best = el; bestText = text; }
  }
  const source = bestText || (document.body ? document.body.innerText : "");
  const paragraphs = source.split(/\n\s*\n/).map(p => p.replace(/\s+/g, " ").trim()).filter(p => p.length > 20).slice(0, 2000);
  return { title: title.trim(), paragraphs: paragraphs };
}

// Minimal stored/deflated ZIP writer (local, no dependencies).
function buildZipBlob(parts) {
  const enc = new TextEncoder();
  const chunks = [];       // file data records
  const central = [];      // central directory records
  let offset = 0;
  for (const part of parts) {
    const nameBytes = enc.encode(part.path);
    const dataBytes = enc.encode(part.content);
    const crc = crc32(dataBytes);
    // Use stored (no compression) for all entries — valid ZIP, keeps code small.
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0, true);
    header.setUint16(8, 0, true);              // method: stored
    header.setUint16(10, 0, true);
    header.setUint16(12, 0, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, dataBytes.length, true);
    header.setUint32(22, dataBytes.length, true);
    header.setUint16(26, nameBytes.length, true);
    header.setUint16(28, 0, true);
    chunks.push(header.buffer, nameBytes, dataBytes);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, 0, true);
    cd.setUint16(14, 0, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, dataBytes.length, true);
    cd.setUint32(24, dataBytes.length, true);
    cd.setUint16(28, nameBytes.length, true);
    for (let i = 30; i < 46; i++) cd.setUint8(i, 0);
    cd.setUint32(42, offset, true);
    central.push(cd.buffer, nameBytes);
    offset += 30 + nameBytes.length + dataBytes.length;
  }
  const cdStart = offset;
  const cdSize = central.reduce((n, b) => n + (b.byteLength || b.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, parts.length, true);
  end.setUint16(10, parts.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, cdStart, true);
  return new Blob([...chunks, ...central, end.buffer], { type: "application/epub+zip" });
}

function crc32(bytes) {
  let table = crc32._t;
  if (!table) {
    table = crc32._t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
