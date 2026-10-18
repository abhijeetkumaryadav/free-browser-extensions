// CiteClip — popup logic: clip library with search, citation formatting,
// per-clip copy/delete, JSON export and clear-all. All data stays in
// chrome.storage.local (on-device).

const $ = (id) => document.getElementById(id);

const state = {
  clips: [],          // [{id, quote, title, url, accessedAt}]
  filter: '',
  format: 'markdown'  // markdown | apa | plain
};

/* ------------------------------------------------------------------ */
/* Citation formatting                                                 */
/* ------------------------------------------------------------------ */

// Escape Markdown special chars that would corrupt blockquote/list syntax.
function mdEscape(s) {
  return s.replace(/([\\`*_{}[\]()#+\-.!>])/g, '\\$1');
}

function shortDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? 'n.d.' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function isoDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

function formatCitation(clip) {
  const quote = clip.quote.replace(/\s+/g, ' ').trim();
  const host = (() => { try { return new URL(clip.url).hostname; } catch { return clip.url; } })();
  const when = shortDate(clip.accessedAt);

  if (state.format === 'markdown') {
    return `> "${quote}"\n>\n> — ${clip.title}\n\nSource: [${host}](${clip.url}) · Accessed ${isoDate(clip.accessedAt)}`;
  }
  if (state.format === 'apa') {
    // APA-ish adaptation for web quotes (no author available).
    return `"${quote}" (${clip.title}, ${when}). Retrieved from ${clip.url}`;
  }
  // plain
  return `"${quote}"\n— ${clip.title}\n${clip.url}\nAccessed: ${when}`;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const ICON_DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
const ICON_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>';

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function matchesFilter(clip) {
  if (!state.filter) return true;
  const hay = (clip.quote + ' ' + clip.title + ' ' + clip.url).toLowerCase();
  return hay.includes(state.filter);
}

function render() {
  const list = $('clipList');
  const visible = state.clips.filter(matchesFilter);

  $('countBadge').textContent = state.clips.length;
  $('emptyState').classList.toggle('show', state.clips.length === 0);
  list.style.display = state.clips.length === 0 ? 'none' : 'flex';

  if (state.clips.length > 0 && visible.length === 0) {
    list.innerHTML = '<div class="empty show" style="padding:24px"><p><strong>No matches</strong></p><p class="hint">Try a different search term.</p></div>';
    return;
  }

  list.innerHTML = '';
  for (const clip of visible) {
    const el = document.createElement('article');
    el.className = 'clip';
    el.innerHTML = `
      <blockquote>${escapeHtml(clip.quote)}</blockquote>
      <div class="meta">
        <span class="title">${escapeHtml(clip.title || 'Untitled page')}</span>
        ${clip.url ? `<a href="#" data-act="open" title="${escapeHtml(clip.url)}">${escapeHtml(clip.url.length > 52 ? clip.url.slice(0, 52) + '…' : clip.url)}</a> · ` : ''}
        <span class="date">Clipped ${escapeHtml(isoDate(clip.accessedAt))}</span>
      </div>
      <div class="clip-actions">
        <button class="icon-btn copy" data-act="copy">${ICON_COPY} Copy citation</button>
        <button class="icon-btn" data-act="open">${ICON_OPEN} Open source</button>
        <button class="icon-btn del" data-act="del">${ICON_DEL} Delete</button>
      </div>`;

    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'copy') copyCitation(clip, btn);
      else if (act === 'del') deleteClip(clip.id);
      else if (act === 'open' && clip.url) chrome.tabs.create({ url: clip.url });
      e.preventDefault();
    });

    list.appendChild(el);
  }
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

async function copyCitation(clip, btn) {
  try {
    await navigator.clipboard.writeText(formatCitation(clip));
    const old = btn.innerHTML;
    btn.innerHTML = '✓ Copied';
    setTimeout(() => { btn.innerHTML = old; }, 1400);
    toast('Citation copied to clipboard');
  } catch {
    toast('Copy failed — clipboard unavailable');
  }
}

async function deleteClip(id) {
  state.clips = state.clips.filter((c) => c.id !== id);
  await persist();
  render();
  toast('Clip deleted');
}

async function persist() {
  await chrome.storage.local.set({ clips: state.clips });
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1800);
}

function downloadJson() {
  if (state.clips.length === 0) { toast('Nothing to export'); return; }
  const blob = new Blob([JSON.stringify(state.clips, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'citeclip-export-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Exported ' + state.clips.length + ' clip(s)');
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

$('searchInput').addEventListener('input', (e) => {
  state.filter = e.target.value.trim().toLowerCase();
  render();
});

document.querySelectorAll('.seg').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.format = btn.dataset.format;
    chrome.storage.local.set({ citeFormat: state.format });
  });
});

$('exportBtn').addEventListener('click', downloadJson);

$('clearBtn').addEventListener('click', async () => {
  if (state.clips.length === 0) return;
  if (confirm('Delete all ' + state.clips.length + ' saved clip(s)? This cannot be undone.')) {
    state.clips = [];
    await persist();
    render();
    toast('Library cleared');
  }
});

// Init: load clips + remembered citation format.
(async function init() {
  const { clips = [], citeFormat = 'markdown' } = await chrome.storage.local.get(['clips', 'citeFormat']);
  state.clips = clips;
  state.format = citeFormat;
  document.querySelectorAll('.seg').forEach((b) =>
    b.classList.toggle('active', b.dataset.format === citeFormat));
  render();
})();
