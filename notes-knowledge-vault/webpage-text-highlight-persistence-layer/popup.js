/* HighlightLayer — popup logic */
'use strict';

const COLOR_HEX = {
  yellow: '#fde047',
  lime: '#a3e635',
  cyan: '#22d3ee',
  pink: '#f472b6'
};

let tabId = null;
let tabUrl = null;

// Send a message to the active tab's content script
async function sendToTab(msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch (err) {
    return { ok: false, reason: 'no-content-script' };
  }
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function refreshList() {
  const res = await sendToTab({ type: 'HLP_LIST' });
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');
  const highlights = (res && res.ok && res.highlights) || [];

  document.getElementById('count').textContent = highlights.length;
  listEl.innerHTML = '';

  if (highlights.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  // Newest first
  [...highlights].reverse().forEach((h) => {
    const item = document.createElement('div');
    item.className = 'hl-item';
    item.innerHTML =
      `<span class="hl-dot" style="background:${COLOR_HEX[h.color] || COLOR_HEX.yellow}"></span>` +
      `<span class="hl-text" title="${escapeHtml(h.text)}">${escapeHtml(h.text)}</span>` +
      `<button class="mini" data-act="jump" title="Jump to highlight">Go</button>` +
      `<button class="mini del" data-act="del" title="Delete highlight">✕</button>`;
    item.querySelector('[data-act="jump"]').addEventListener('click', async () => {
      await sendToTab({ type: 'HLP_JUMP', id: h.id });
    });
    item.querySelector('[data-act="del"]').addEventListener('click', async () => {
      await sendToTab({ type: 'HLP_REMOVE', id: h.id });
      refreshList();
    });
    listEl.appendChild(item);
  });
}

async function exportMarkdown() {
  const res = await sendToTab({ type: 'HLP_LIST' });
  const highlights = (res && res.ok && res.highlights) || [];
  if (highlights.length === 0) return;

  const title = tabUrl ? new URL(tabUrl).hostname : 'page';
  let md = `# Highlights — ${title}\n\nSource: ${tabUrl}\nExported: ${new Date().toLocaleString()}\n\n`;
  highlights.forEach((h, i) => {
    md += `## ${i + 1}. ${h.color.charAt(0).toUpperCase() + h.color.slice(1)} — ${fmtDate(h.createdAt)}\n\n`;
    md += `> ${h.text.replace(/\n/g, '\n> ')}\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `highlights-${title.replace(/[^a-z0-9]+/gi, '-')}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  tabId = tab.id;
  tabUrl = tab.url || '';

  const supported = /^https?:\/\//i.test(tabUrl);
  document.getElementById('unsupported').classList.toggle('hidden', supported);
  if (tabUrl) {
    try {
      document.getElementById('pageHost').textContent = new URL(tabUrl).hostname;
    } catch (e) { /* keep default */ }
  }

  document.querySelectorAll('.swatch').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!supported) return;
      const res = await sendToTab({ type: 'HLP_HIGHLIGHT_SELECTION', color: btn.dataset.color });
      if (res && res.ok) {
        refreshList();
      } else if (res && res.reason === 'no-selection') {
        btn.style.transform = 'scale(1.25)';
        setTimeout(() => { btn.style.transform = ''; }, 300);
      }
    });
  });

  document.getElementById('exportBtn').addEventListener('click', exportMarkdown);
  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('Remove all highlights on this page?')) {
      await sendToTab({ type: 'HLP_CLEAR' });
      refreshList();
    }
  });

  if (supported) refreshList();
}

document.addEventListener('DOMContentLoaded', init);
