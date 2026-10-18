/* Universal Markdown Clipper — content script (runs in the page on click).
   Extracts title, URL, meta description, selection or main-article HTML,
   then converts it to Obsidian-friendly Markdown. All local, no network. */
'use strict';

// --- helpers ---------------------------------------------------------------
function escapeMd(text) {
  return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
}

function cleanText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/** Best-effort main-content element: <article>/<main>, else cleaned body. */
function findMain() {
  const article = document.querySelector('article');
  if (article && cleanText(article.innerText).length > 200) return article;
  const main = document.querySelector('main');
  if (main && cleanText(main.innerText).length > 200) return main;
  return document.body;
}

/** Turn an HTML fragment into Markdown (recursive walker). */
function htmlToMarkdown(root, opts) {
  let md = '';
  const INLINE_SKIP = new Set(['script', 'style', 'noscript', 'svg', 'canvas', 'video', 'iframe', 'nav', 'header', 'footer', 'aside', 'form']);

  function walk(node, listDepth) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        md += child.textContent.replace(/\s+/g, ' ');
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName.toLowerCase();

      if (INLINE_SKIP.has(tag)) continue;

      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1], 10);
        md += '\n\n' + '#'.repeat(level) + ' ' + cleanText(child.textContent) + '\n';
      } else if (tag === 'p') {
        md += '\n\n' + inlineChildren(child, listDepth) + '\n';
      } else if (tag === 'br') {
        md += '  \n';
      } else if (tag === 'a') {
        const href = child.getAttribute('href');
        const text = cleanText(child.textContent);
        md += text ? `[${text}](${href || ''})` : '';
      } else if (tag === 'img') {
        if (opts.images) {
          const src = child.getAttribute('src');
          const alt = child.getAttribute('alt') || 'image';
          if (src) md += `![${alt}](${src})`;
        }
      } else if (tag === 'ul' || tag === 'ol') {
        md += '\n';
        let i = 1;
        for (const li of child.children) {
          if (li.tagName.toLowerCase() !== 'li') continue;
          const bullet = tag === 'ul' ? '-' : `${i}.`;
          md += '  '.repeat(listDepth) + bullet + ' ' + inlineChildren(li, listDepth + 1).trim() + '\n';
          i++;
        }
        md += '\n';
      } else if (tag === 'li') {
        md += '- ' + inlineChildren(child, listDepth).trim() + '\n';
      } else if (tag === 'blockquote') {
        const quoted = cleanText(child.textContent).split('\n').map(l => '> ' + l).join('\n');
        md += '\n\n' + quoted + '\n';
      } else if (tag === 'pre' || tag === 'code') {
        const code = child.textContent.replace(/^\n+|\n+$/g, '');
        md += '\n\n```\n' + code + '\n```\n';
      } else if (tag === 'strong' || tag === 'b') {
        md += '**' + cleanText(child.textContent) + '**';
      } else if (tag === 'em' || tag === 'i') {
        md += '*' + cleanText(child.textContent) + '*';
      } else if (tag === 'hr') {
        md += '\n\n---\n\n';
      } else {
        walk(child, listDepth); // inline containers: recurse
      }
    }
  }

  /** Renders inline-ish children without block separators. */
  function inlineChildren(el, listDepth) {
    const saved = md;
    md = '';
    walk(el, listDepth);
    const out = md.replace(/\s+/g, ' ').trim();
    md = saved;
    return out;
  }

  walk(root, 0);
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

/** Build the final clip from page data. */
function buildClip(opts) {
  const sel = window.getSelection().toString().trim();
  let body = '', source = '';

  if (opts.selectionOnly && sel) {
    body = sel.split('\n').map(l => l.trim()).filter(Boolean).join('\n\n');
    source = 'selection';
  } else {
    const main = findMain();
    body = htmlToMarkdown(main, opts);
    source = 'page';
  }

  return {
    title: cleanText(document.title) || 'Untitled',
    url: location.href,
    description: cleanText(document.querySelector('meta[name="description"]')?.content),
    clippedAt: new Date().toISOString(),
    source,
    body
  };
}

// Respond to the popup's single request.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'clip-request') {
    try {
      sendResponse({ ok: true, clip: buildClip(msg.opts) });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return true;
  }
});
