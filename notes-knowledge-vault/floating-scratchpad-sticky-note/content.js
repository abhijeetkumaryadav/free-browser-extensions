/* StickyPad content script — floating sticky notes overlay.
 * Injected on demand (activeTab + scripting). Runs in ISOLATED world by default,
 * so a shadow-DOM host keeps page styles from leaking in.
 * All notes persist in chrome.storage.local under key "stickypad.notes".
 * Messages from popup/background: {type:"ping"}, {type:"add"}, {type:"reload"}.
 */
(() => {
  'use strict';

  // Guard: only one instance per frame.
  if (window.__stickyPadActive) {
    // Allow ping replies even if already injected.
    window.__stickyPadPing = true;
    chrome.runtime.onMessage.addListener((msg, _s, reply) => {
      if (msg && msg.type === 'ping') reply({ ok: true, count: window.__stickyPadCount || 0 });
      if (msg && msg.type === 'add') { window.__stickyPadAdd && window.__stickyPadAdd(); reply({ ok: true }); }
      if (msg && msg.type === 'reload') { window.__stickyPadReload && window.__stickyPadReload(); reply({ ok: true }); }
    });
    return;
  }
  window.__stickyPadActive = true;

  const STORAGE_KEY = 'stickypad.notes';
  const pageUrl = location.href;
  const COLORS = {
    yellow: { bg: '#fef08a', head: '#eab308', fg: '#422006' },
    pink:   { bg: '#fecdd3', head: '#f43f5e', fg: '#4c0519' },
    green:  { bg: '#bbf7d0', head: '#22c55e', fg: '#052e16' },
    blue:   { bg: '#bfdbfe', head: '#3b82f6', fg: '#172554' },
    purple: { bg: '#ddd6fe', head: '#8b5cf6', fg: '#2e1065' },
  };
  const COLOR_NAMES = Object.keys(COLORS);

  const host = document.createElement('div');
  host.id = '__stickypad-host';
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });
  document.documentElement.appendChild(host);

  const style = document.createElement('style');
  style.textContent = `
    .sp-note { position:fixed; pointer-events:auto; border-radius:10px;
      box-shadow:0 8px 30px rgba(0,0,0,.45); display:flex; flex-direction:column;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow:hidden; }
    .sp-head { display:flex; align-items:center; gap:6px; padding:6px 8px; cursor:move;
      user-select:none; -webkit-user-select:none; }
    .sp-dot { width:11px; height:11px; border-radius:50%; border:1px solid rgba(0,0,0,.25); cursor:pointer; flex-shrink:0; }
    .sp-spacer { flex:1; }
    .sp-btn { background:transparent; border:none; cursor:pointer; padding:2px; color:inherit;
      opacity:.65; display:inline-flex; border-radius:4px; }
    .sp-btn:hover { opacity:1; background:rgba(0,0,0,.08); }
    .sp-btn svg { width:13px; height:13px; }
    .sp-body { flex:1; display:flex; flex-direction:column; min-height:0; }
    .sp-body textarea { flex:1; resize:none; border:none; outline:none; background:transparent;
      color:inherit; font-size:13px; line-height:1.5; padding:8px 10px; font-family:inherit; min-height:40px; }
    .sp-resize { position:absolute; right:2px; bottom:2px; width:16px; height:16px; cursor:nwse-resize; opacity:.5; }
    .sp-min { padding:8px 10px; font-size:12px; font-style:italic; opacity:.7; cursor:pointer; }
  `;
  shadow.appendChild(style);

  /** @type {Map<string, {el:HTMLElement, data:Object}>} */
  const notes = new Map();
  window.__stickyPadCount = 0;

  function uid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  async function loadAll() {
    const r = await chrome.storage.local.get(STORAGE_KEY);
    return r[STORAGE_KEY] || {};
  }
  async function saveAll(map) { await chrome.storage.local.set({ [STORAGE_KEY]: map }); }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const all = await loadAll();
      for (const [id, n] of notes) all[id] = n.data;
      await saveAll(all);
    }, 400);
  }

  function iconSvg(path) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">${path}</svg>`;
  }
  const ICONS = {
    min: iconSvg('<path d="M5 12h14"/>'),
    max: iconSvg('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
    close: iconSvg('<path d="M18 6 6 18M6 6l12 12"/>'),
  };

  function applyColors(el, color) {
    const c = COLORS[color] || COLORS.yellow;
    el.style.background = c.bg;
    el.style.color = c.fg;
    el.querySelector('.sp-head').style.background = c.head;
    el.querySelector('.sp-head').style.color = '#fff';
  }

  function createNote(data) {
    const d = Object.assign({
      id: uid(), url: pageUrl, x: 60 + notes.size * 24, y: 60 + notes.size * 24,
      w: 220, h: 190, color: 'yellow', text: '', minimized: false,
    }, data);

    const el = document.createElement('div');
    el.className = 'sp-note';
    el.innerHTML = `
      <div class="sp-head">
        <span class="sp-dots" style="display:flex;gap:5px"></span>
        <span class="sp-spacer"></span>
        <button class="sp-btn sp-toggle" title="Minimize / restore">${ICONS.min}</button>
        <button class="sp-btn sp-close" title="Delete note">${ICONS.close}</button>
      </div>
      <div class="sp-body"><textarea placeholder="Type your note…"></textarea></div>
      <div class="sp-resize"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 4 4 20M20 12l-4 4M12 20l-4-4"/></svg></div>
    `;
    shadow.appendChild(el);

    const dots = el.querySelector('.sp-dots');
    for (const name of COLOR_NAMES) {
      const dot = document.createElement('span');
      dot.className = 'sp-dot';
      dot.title = name;
      dot.style.background = COLORS[name].head;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        d.color = name; applyColors(el, name); scheduleSave();
      });
      dots.appendChild(dot);
    }

    const head = el.querySelector('.sp-head');
    const body = el.querySelector('.sp-body');
    const ta = el.querySelector('textarea');
    ta.value = d.text || '';

    function layout() {
      el.style.left = d.x + 'px'; el.style.top = d.y + 'px';
      el.style.width = d.w + 'px'; el.style.height = d.minimized ? 'auto' : d.h + 'px';
      body.style.display = d.minimized ? 'none' : 'flex';
      el.querySelector('.sp-resize').style.display = d.minimized ? 'none' : 'block';
      el.querySelector('.sp-toggle').innerHTML = d.minimized ? ICONS.max : ICONS.min;
    }
    applyColors(el, d.color);
    layout();

    // --- Drag by header ---
    head.addEventListener('mousedown', (e) => {
      if (e.target.closest('.sp-btn') || e.target.closest('.sp-dot')) return;
      e.preventDefault();
      const sx = e.clientX - d.x, sy = e.clientY - d.y;
      const move = (ev) => {
        d.x = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - sx));
        d.y = Math.max(0, Math.min(window.innerHeight - 30, ev.clientY - sy));
        el.style.left = d.x + 'px'; el.style.top = d.y + 'px';
      };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); scheduleSave(); };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });

    // --- Resize by corner handle ---
    const grip = el.querySelector('.sp-resize');
    grip.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const sw = d.w, sh = d.h, sx = e.clientX, sy = e.clientY;
      const move = (ev) => {
        d.w = Math.max(140, sw + (ev.clientX - sx));
        d.h = Math.max(110, sh + (ev.clientY - sy));
        el.style.width = d.w + 'px'; el.style.height = d.h + 'px';
      };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); scheduleSave(); };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });

    // --- Text edits ---
    ta.addEventListener('input', () => { d.text = ta.value; scheduleSave(); });

    // --- Minimize / restore ---
    el.querySelector('.sp-toggle').addEventListener('click', () => { d.minimized = !d.minimized; layout(); scheduleSave(); });

    // --- Delete ---
    el.querySelector('.sp-close').addEventListener('click', async () => {
      notes.delete(d.id); el.remove();
      const all = await loadAll(); delete all[d.id]; await saveAll(all);
      window.__stickyPadCount = notes.size;
    });

    notes.set(d.id, { el, data: d });
    window.__stickyPadCount = notes.size;
    scheduleSave();
    return d;
  }

  async function addNote() {
    const d = createNote({});
    // Focus its textarea after paint
    requestAnimationFrame(() => {
      const n = notes.get(d.id);
      if (n) n.el.querySelector('textarea').focus();
    });
  }

  async function reloadNotes() {
    for (const [, n] of notes) n.el.remove();
    notes.clear();
    const all = await loadAll();
    for (const id of Object.keys(all)) {
      if (all[id].url === pageUrl) createNote(all[id]);
    }
    window.__stickyPadCount = notes.size;
  }

  window.__stickyPadAdd = addNote;
  window.__stickyPadReload = reloadNotes;

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg && msg.type === 'ping') reply({ ok: true, count: notes.size });
    if (msg && msg.type === 'add') addNote().then(() => reply({ ok: true }));
    if (msg && msg.type === 'reload') reloadNotes().then(() => reply({ ok: true }));
    return true;
  });

  // Initial load for this page.
  reloadNotes();
})();
