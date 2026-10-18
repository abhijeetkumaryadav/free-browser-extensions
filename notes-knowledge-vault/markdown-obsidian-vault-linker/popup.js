/* VaultLink — Obsidian-style markdown vault. 100% local, storage-only. */
(() => {
  'use strict';

  const STORAGE_KEY = 'vaultlink.notes';
  const $ = (id) => document.getElementById(id);

  // ---------- state ----------
  let notes = {};          // id -> {title, body, updated}
  let currentId = null;    // note open in editor
  let mode = 'edit';       // 'edit' | 'preview'
  let saveTimer = null;

  // ---------- helpers ----------
  function uid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function findByTitle(title) {
    const t = title.trim().toLowerCase();
    return Object.keys(notes).find((id) => notes[id].title.trim().toLowerCase() === t) || null;
  }

  /** Extract [[links]] from markdown body. Returns array of raw target titles. */
  function extractLinks(body) {
    const out = [];
    const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let m;
    while ((m = re.exec(body)) !== null) out.push(m[1].trim());
    return out;
  }

  /** Backlinks: ids of notes (≠ id) whose body links to the note's title. */
  function backlinksOf(id) {
    const title = notes[id].title.trim().toLowerCase();
    return Object.keys(notes).filter((other) =>
      other !== id && extractLinks(notes[other].body).some((t) => t.toLowerCase() === title));
  }

  async function persist() {
    await chrome.storage.local.set({ [STORAGE_KEY]: notes });
  }

  // ---------- tiny markdown renderer (XSS-safe: escape first) ----------
  function renderMarkdown(src) {
    // 1. Pull out fenced code blocks as placeholders.
    const blocks = [];
    let text = esc(src).replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
      blocks.push(`<pre><code>${code}</code></pre>`);
      return `\u0000${blocks.length - 1}\u0000`;
    });

    // 2. Block-level transforms, line by line.
    const lines = text.split('\n');
    let html = '';
    let inList = null; // 'ul' | 'ol' | null
    const closeList = () => { if (inList) { html += `</${inList}>`; inList = null; } };

    for (const raw of lines) {
      const line = raw;
      if (/^\u0000\d+\u0000$/.test(line.trim())) { closeList(); html += line.trim(); continue; }
      let m;
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        closeList();
        const lvl = m[1].length;
        html += `<h${lvl}>${inline(m[2])}</h${lvl}>`;
      } else if (/^---+$/.test(line.trim())) {
        closeList(); html += '<hr>';
      } else if ((m = line.match(/^&gt;\s?(.*)$/))) {
        closeList(); html += `<blockquote>${inline(m[1])}</blockquote>`;
      } else if ((m = line.match(/^(\s*)[-*]\s+(.*)$/))) {
        if (inList !== 'ul') { closeList(); html += '<ul>'; inList = 'ul'; }
        html += `<li>${inline(m[2])}</li>`;
      } else if ((m = line.match(/^(\s*)\d+[.)]\s+(.*)$/))) {
        if (inList !== 'ol') { closeList(); html += '<ol>'; inList = 'ol'; }
        html += `<li>${inline(m[2])}</li>`;
      } else if (line.trim() === '') {
        closeList();
      } else {
        closeList(); html += `<p>${inline(line)}</p>`;
      }
    }
    closeList();

    // 3. Restore code blocks.
    html = html.replace(/\u0000(\d+)\u0000/g, (_m, i) => blocks[Number(i)]);
    return html;
  }

  /** Inline transforms on already-escaped text. */
  function inline(s) {
    // wiki-links first (they may contain characters other rules would eat)
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => {
      const label = esc((alias || target).trim());
      const exists = findByTitle(target) !== null;
      return `<a class="wiki-link${exists ? '' : ' missing'}" data-wiki="${esc(target.trim())}" href="#">${label}</a>`;
    });
    // external markdown links
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a class="ext" href="$2" target="_blank" rel="noopener">$1</a>');
    // inline code
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // bold + italic (order matters)
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return s;
  }

  // ---------- views ----------
  const editor = $('editor');
  const tabPages = { notes: $('tab-notes'), graph: $('tab-graph') };

  function showEditor(show) {
    editor.classList.toggle('hidden', !show);
    document.querySelectorAll('.tab-page').forEach((p) => p.classList.toggle('active', false));
    if (!show) {
      const activeTab = document.querySelector('.tab.active')?.dataset.tab || 'notes';
      tabPages[activeTab].classList.add('active');
    }
  }

  function renderList() {
    const q = $('searchInput').value.trim().toLowerCase();
    const list = $('notesList');
    list.innerHTML = '';
    const ids = Object.keys(notes).sort((a, b) => notes[b].updated - notes[a].updated)
      .filter((id) => !q || notes[id].title.toLowerCase().includes(q) || notes[id].body.toLowerCase().includes(q));

    if (!ids.length) {
      list.innerHTML = `<p class="empty">${q ? 'No notes match your search.' : 'No notes yet — hit New to start your vault.'}</p>`;
      return;
    }
    for (const id of ids) {
      const n = notes[id];
      const card = document.createElement('div');
      card.className = 'note-card';
      const links = extractLinks(n.body).length;
      const backs = backlinksOf(id).length;
      const snippet = n.body.replace(/[#>*`\[\]-]/g, '').trim().split('\n')[0] || 'Empty note';
      card.innerHTML = `
        <div class="t"></div>
        <div class="s"></div>
        <div class="meta"><span>${esc(fmtDate(n.updated))}</span><span class="links">${links} link${links === 1 ? '' : 's'} · ${backs} backlink${backs === 1 ? '' : 's'}</span></div>`;
      card.querySelector('.t').textContent = n.title || 'Untitled';
      card.querySelector('.s').textContent = snippet.slice(0, 80);
      card.addEventListener('click', () => openNote(id));
      list.appendChild(card);
    }
  }

  function renderGraph() {
    const ids = Object.keys(notes);
    const totalLinks = ids.reduce((s, id) => s + extractLinks(notes[id].body).length, 0);
    const orphans = ids.filter((id) => backlinksOf(id).length === 0 && extractLinks(notes[id].body).length === 0).length;
    $('graphStats').innerHTML = `
      <div class="stat"><div class="n">${ids.length}</div><div class="l">notes</div></div>
      <div class="stat"><div class="n">${totalLinks}</div><div class="l">wiki-links</div></div>
      <div class="stat"><div class="n">${orphans}</div><div class="l">orphans</div></div>`;

    const list = $('graphList');
    list.innerHTML = '';
    if (!ids.length) { list.innerHTML = '<p class="empty">Your link graph will appear here.</p>'; return; }

    const sorted = [...ids].sort((a, b) => backlinksOf(b).length - backlinksOf(a).length);
    for (const id of sorted) {
      const n = notes[id];
      const backs = backlinksOf(id);
      const card = document.createElement('div');
      card.className = 'note-card';
      const linkNames = extractLinks(n.body).map((t) => findByTitle(t) ? t : t + ' ✎').slice(0, 4);
      card.innerHTML = `
        <div class="t"></div>
        <div class="s">→ ${linkNames.length ? '' : 'no outgoing links'}</div>
        <div class="meta"><span class="links">${backs.length} backlink${backs.length === 1 ? '' : 's'}</span></div>`;
      card.querySelector('.t').textContent = n.title || 'Untitled';
      if (linkNames.length) card.querySelector('.s').textContent = '→ ' + linkNames.join(' · ');
      card.addEventListener('click', () => openNote(id));
      list.appendChild(card);
    }
  }

  function renderBacklinks() {
    const list = $('backlinksList');
    list.innerHTML = '';
    const backs = backlinksOf(currentId);
    $('backlinkCount').textContent = backs.length;
    if (!backs.length) { list.innerHTML = '<p class="empty">No notes link here yet.</p>'; return; }
    for (const id of backs) {
      const el = document.createElement('div');
      el.className = 'backlink';
      el.textContent = '◀ ' + (notes[id].title || 'Untitled');
      el.addEventListener('click', () => openNote(id));
      list.appendChild(el);
    }
  }

  function renderPreview() {
    const pv = $('preview');
    pv.innerHTML = renderMarkdown($('bodyInput').value);
    pv.querySelectorAll('[data-wiki]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = a.getAttribute('data-wiki');
        const id = findByTitle(target);
        if (id) openNote(id);
        else createNote(target); // missing link → create it
      });
    });
  }

  function setMode(m) {
    mode = m;
    $('editModeBtn').classList.toggle('active', m === 'edit');
    $('previewModeBtn').classList.toggle('active', m === 'preview');
    $('bodyInput').classList.toggle('hidden', m !== 'edit');
    $('preview').classList.toggle('hidden', m !== 'preview');
    if (m === 'preview') renderPreview();
  }

  function markDirty() {
    $('saveState').textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const n = notes[currentId];
      if (!n) return;
      n.title = $('titleInput').value.trim() || 'Untitled';
      n.body = $('bodyInput').value;
      n.updated = Date.now();
      await persist();
      $('saveState').textContent = 'Saved';
      renderList();
      renderBacklinks();
      if (mode === 'preview') renderPreview();
    }, 600);
  }

  function openNote(id) {
    currentId = id;
    const n = notes[id];
    $('titleInput').value = n.title;
    $('bodyInput').value = n.body;
    $('saveState').textContent = 'Saved';
    setMode('edit');
    showEditor(true);
    renderBacklinks();
  }

  async function createNote(prefillTitle = '') {
    const id = uid();
    notes[id] = { title: prefillTitle || 'Untitled', body: '', updated: Date.now() };
    await persist();
    renderList(); renderGraph();
    openNote(id);
    $('titleInput').focus();
    $('titleInput').select();
  }

  function closeEditor() {
    currentId = null;
    showEditor(false);
    renderList(); renderGraph();
  }

  // ---------- export ----------
  function sanitizeFilename(t) {
    return (t || 'untitled').replace(/[\\/:*?"<>|#\[\]]/g, '').trim().slice(0, 60) || 'untitled';
  }
  function download(filename, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  $('exportBtn').addEventListener('click', () => {
    const ids = Object.keys(notes);
    if (!ids.length) return;
    // Stagger separate .md downloads so the browser accepts each one.
    ids.forEach((id, i) => {
      setTimeout(() => download(sanitizeFilename(notes[id].title) + '.md', notes[id].body), i * 400);
    });
  });

  // ---------- events ----------
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const name = t.dataset.tab;
      Object.keys(tabPages).forEach((k) => tabPages[k].classList.toggle('active', k === name));
      if (name === 'graph') renderGraph(); else renderList();
    });
  });
  $('searchInput').addEventListener('input', renderList);
  $('newBtn').addEventListener('click', () => createNote());
  $('backBtn').addEventListener('click', closeEditor);
  $('editModeBtn').addEventListener('click', () => setMode('edit'));
  $('previewModeBtn').addEventListener('click', () => setMode('preview'));
  $('titleInput').addEventListener('input', markDirty);
  $('bodyInput').addEventListener('input', markDirty);
  $('deleteBtn').addEventListener('click', async () => {
    if (!currentId) return;
    if (!confirm(`Delete "${notes[currentId].title}"?`)) return;
    delete notes[currentId];
    await persist();
    closeEditor();
  });

  // ---------- init ----------
  (async () => {
    notes = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
    renderList();
  })();
})();
