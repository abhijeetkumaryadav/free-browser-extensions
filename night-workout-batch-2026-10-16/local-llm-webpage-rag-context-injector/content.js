// Page Context Packager — content script
// Extracts the current page into clean structured markdown.
// Runs only when the user clicks "Extract" (injected via chrome.scripting).

(() => {
  'use strict';

  // Selectors for chrome we never want in the context output.
  const JUNK_SELECTOR =
    'nav, header, footer, aside, script, style, noscript, iframe, svg, ' +
    '[role="banner"], [role="navigation"], [role="complementary"], ' +
    '[class*="ad-"], [id*="ad-"], [class*="cookie"], [id*="cookie"], ' +
    '[class*="newsletter"], [class*="popup"], [class*="modal"]';

  // Prefer the semantic main container; fall back gracefully.
  function findMainRoot() {
    return (
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.body
    );
  }

  // Collapse whitespace for clean single-line text.
  function cleanText(node) {
    return (node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // Convert a single element into markdown lines.
  function elementToMarkdown(el, lines) {
    if (el.matches(JUNK_SELECTOR)) return; // skip chrome early

    const tag = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const text = cleanText(el);
      if (text) lines.push(`${'#'.repeat(parseInt(tag[1], 10))} ${text}`, '');
      return;
    }
    if (tag === 'p' || tag === 'blockquote') {
      const text = inlineToMarkdown(el);
      if (text) lines.push(tag === 'blockquote' ? `> ${text}` : text, '');
      return;
    }
    if (tag === 'li') {
      const text = inlineToMarkdown(el);
      if (text) lines.push(`- ${text}`);
      return;
    }
    if (tag === 'pre') {
      const code = (el.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
      if (code) lines.push('```', code, '```', '');
      return;
    }
    if (tag === 'table') {
      tableToMarkdown(el, lines);
      return;
    }
    if (tag === 'a' && el.parentElement && !el.parentElement.closest('p, li, h1, h2, h3, h4, h5, h6')) {
      // Standalone link (not inline in text): keep as reference line.
      const text = cleanText(el) || el.href;
      if (text && el.href && el.href.startsWith('http')) lines.push(`[${text}](${el.href})`);
      return;
    }
    // Generic container: recurse into children to preserve order.
    for (const child of el.children) elementToMarkdown(child, lines);
  }

  // Render inline content: text + links as markdown links.
  function inlineToMarkdown(el) {
    const parts = [];
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent.replace(/\s+/g, ' '));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const t = node.tagName.toLowerCase();
        if (t === 'script' || t === 'style' || t === 'svg') return;
        if (t === 'a' && node.href && node.href.startsWith('http')) {
          const label = cleanText(node) || node.href;
          parts.push(`[${label}](${node.href})`);
        } else if (t === 'br') {
          parts.push('\n');
        } else {
          for (const c of node.childNodes) walk(c);
        }
      }
    };
    for (const c of el.childNodes) walk(c);
    return parts.join('').replace(/[ \t]+/g, ' ').trim();
  }

  // Simple table -> markdown table (first row = header).
  function tableToMarkdown(table, lines) {
    const rows = [...table.rows].map((r) =>
      [...r.cells].map((c) => cleanText(c).replace(/\|/g, '\\|'))
    ).filter((r) => r.some((c) => c));
    if (!rows.length) return;
    const cols = Math.max(...rows.map((r) => r.length));
    const pad = (r) => { while (r.length < cols) r.push(''); return r; };
    lines.push('| ' + pad(rows[0]).join(' | ') + ' |');
    lines.push('| ' + Array(cols).fill('---').join(' | ') + ' |');
    for (const r of rows.slice(1)) lines.push('| ' + pad(r).join(' | ') + ' |');
    lines.push('');
  }

  // Top-level entry: clone root, strip junk, walk children.
  function extract() {
    const root = findMainRoot();
    const clone = root.cloneNode(true);
    clone.querySelectorAll(JUNK_SELECTOR).forEach((n) => n.remove());

    const lines = [`# ${document.title.trim() || 'Untitled page'}`, '', `Source: ${location.href}`, ''];
    for (const child of clone.children) elementToMarkdown(child, lines);

    // Tidy: collapse 3+ blank lines into two.
    const markdown = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { title: document.title.trim(), url: location.href, markdown };
  }

  // Chunk long markdown on paragraph boundaries with overlap.
  function chunk(markdown, maxChars, overlapChars) {
    const paras = markdown.split(/\n{2,}/);
    const chunks = [];
    let current = '';
    for (const p of paras) {
      if ((current + '\n\n' + p).length > maxChars && current) {
        chunks.push(current.trim());
        // Overlap: carry the tail of this chunk into the next.
        const tail = current.slice(-overlapChars);
        const cut = tail.indexOf('\n');
        current = (cut >= 0 ? tail.slice(cut + 1) : tail).trim();
      }
      current = current ? current + '\n\n' + p : p;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [''];
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PCP_EXTRACT') {
      const { markdown, title, url } = extract();
      const words = markdown.split(/\s+/).filter(Boolean).length;
      const chunks = chunk(markdown, msg.maxChars || 4000, msg.overlap || 400);
      sendResponse({ ok: true, title, url, markdown, chunks, words, chars: markdown.length });
    }
    return true;
  });
})();
