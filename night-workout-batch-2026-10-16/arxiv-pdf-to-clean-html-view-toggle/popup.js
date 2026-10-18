'use strict';
/* Clean Read Toggle — user-triggered reading overlay. Zero network. */

// ENGINE-START
// Pure, testable helpers for the extraction heuristic.

const SKIP_RE = /<(nav|header|footer|aside|script|style|noscript|form|menu)[\s>][\s\S]*?<\/\1\s*>/gi;

// Strip skipped regions and all tags, returning clean paragraphs.
function extractParagraphs(html) {
  if (typeof html !== 'string') return [];
  let h = html.replace(SKIP_RE, '\n');        // drop nav/header/footer/aside/etc.
  h = h.replace(/<br\s*\/?>/gi, '\n');        // keep line breaks
  h = h.replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n'); // block ends
  h = h.replace(/<[^>]*>/g, '');             // remaining tags
  h = h.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  return h.split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trim())
    .filter(l => l.length >= 40);             // ignore fragments (min 40 chars)
}

// Guess the best container's inner HTML from the document's markup:
// prefer <article>, else <main>, else the longest remaining block.
function pickContainerMarkup(html) {
  if (typeof html !== 'string') return '';
  const article = html.match(/<article[\s>][\s\S]*?<\/article\s*>/i);
  if (article && article[0].replace(/<[^>]*>/g, '').trim().length >= 200) return article[0];
  const main = html.match(/<main[\s>][\s\S]*?<\/main\s*>/i);
  if (main && main[0].replace(/<[^>]*>/g, '').trim().length >= 200) return main[0];
  return html;
}

function buildReaderHtml(title, paragraphs) {
  const paras = paragraphs.map(p => `<p>${p}</p>`).join('\n');
  const esc = t => String(t).replace(/[<>&"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  return `<div id="__clean_read_wrap" style="max-width:680px;margin:0 auto;padding:48px 24px;font:18px/1.75 Georgia,serif;color:#e8e8ee">
  <h1 style="font-size:26px;margin:0 0 24px;line-height:1.3">${esc(title)}</h1>
  ${paras || '<p style="color:#9a9aad">No long text blocks found on this page.</p>'}
  </div>`;
}
// ENGINE-END

// ---------- injected overlay toggle (runs in the page) ----------
function toggleCleanReader() {
  const existing = document.getElementById('__clean_reader_overlay');
  if (existing) { existing.remove(); return 'off'; }
  const overlay = document.createElement('div');
  overlay.id = '__clean_reader_overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#101014;overflow-y:auto;';
  const close = document.createElement('button');
  close.textContent = '✕ Close';
  close.style.cssText = 'position:fixed;top:16px;right:16px;z-index:1;background:#22d3ee;color:#062027;border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:13px';
  close.onclick = () => overlay.remove();
  const wrap = document.createElement('div');
  // Rebuild extraction here (injected func cannot see popup.js helpers).
  const html = document.documentElement.outerHTML;
  const pick = html.match(/<article[\s>][\s\S]*?<\/article\s*>/i)
    || html.match(/<main[\s>][\s\S]*?<\/main\s*>/i);
  let body = pick ? pick[0] : html;
  body = body.replace(/<(nav|header|footer|aside|script|style|noscript|form|menu)[\s>][\s\S]*?<\/\1\s*>/gi, '\n')
             .replace(/<br\s*\/?>/gi, '\n')
             .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n')
             .replace(/<[^>]*>/g, '')
             .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const paras = body.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(l => l.length >= 40);
  const esc = t => String(t).replace(/[<>&"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const ph = paras.map(p => `<p style="margin:0 0 18px">${esc(p)}</p>`).join('\n');
  wrap.innerHTML = `<div style="max-width:680px;margin:0 auto;padding:48px 24px;font:18px/1.75 Georgia,serif;color:#e8e8ee">
    <h1 style="font-size:26px;margin:0 0 24px;line-height:1.3">${esc(document.title)}</h1>
    ${ph || '<p style="color:#9a9aad">No long text blocks found on this page.</p>'}</div>`;
  overlay.appendChild(close);
  overlay.appendChild(wrap);
  document.documentElement.appendChild(overlay);
  return 'on';
}

// ---------- popup UI ----------
const $ = id => document.getElementById(id);

$('toggle').addEventListener('click', async () => {
  const status = $('status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) { status.textContent = 'No active tab found.'; return; }
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleCleanReader
    });
    const state = res && res.result;
    $('toggle').textContent = state === 'on' ? 'Turn off clean reading' : 'Turn on clean reading';
    $('toggle').classList.toggle('off', state === 'on');
    status.textContent = state === 'on'
      ? 'Clean reading on — click again to restore the page.'
      : 'Clean reading off — page untouched.';
  } catch (e) {
    status.textContent = 'Could not run here (e.g. chrome:// pages or restricted sites).';
  }
});
