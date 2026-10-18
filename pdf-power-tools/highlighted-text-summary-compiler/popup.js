/* SnippetStack popup — projects, snippet list, compile & export.
 * Storage shape: { projects: [{id, name, snippets:[{id,text,url,title,createdAt}]}], activeProject } */

'use strict';

const $ = (id) => document.getElementById(id);

const wordCount = (s) => (s.trim().match(/\S+/g) || []).length;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let projects = [];
let activeId = null;

const activeProject = () => projects.find((p) => p.id === activeId) || projects[0];

async function load() {
  const data = await chrome.storage.local.get({ projects: [], activeProject: null });
  projects = data.projects;
  if (projects.length === 0) {
    projects = [{ id: 'p1', name: 'Research', snippets: [] }];
    await chrome.storage.local.set({ projects });
  }
  activeId = data.activeProject || projects[0].id;
  if (!projects.some((p) => p.id === activeId)) activeId = projects[0].id;
  render();
}

async function persist() {
  await chrome.storage.local.set({ projects, activeProject: activeId });
}

// ---------- projects ----------
function renderProjectSelect() {
  const sel = $('projectSelect');
  sel.innerHTML = '';
  projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.snippets.length})`;
    if (p.id === activeId) opt.selected = true;
    sel.appendChild(opt);
  });
}

$('projectSelect').addEventListener('change', async (e) => {
  activeId = e.target.value;
  await persist();
  render();
});

$('newProjectBtn').addEventListener('click', async () => {
  const name = prompt('Project name:', 'Research ' + (projects.length + 1));
  if (!name || !name.trim()) return;
  const p = { id: 'p' + Date.now().toString(36), name: name.trim(), snippets: [] };
  projects.push(p);
  activeId = p.id;
  await persist();
  render();
});

$('deleteProjectBtn').addEventListener('click', async () => {
  const p = activeProject();
  if (!p) return;
  if (!confirm(`Delete project "${p.name}" and its ${p.snippets.length} snippet(s)?`)) return;
  projects = projects.filter((x) => x.id !== p.id);
  if (projects.length === 0) projects = [{ id: 'p1', name: 'Research', snippets: [] }];
  activeId = projects[0].id;
  await persist();
  render();
});

// ---------- snippets ----------
function renderSnippets() {
  const p = activeProject();
  const list = $('snippetList');
  list.innerHTML = '';
  $('snippetCount').textContent = p.snippets.length;

  const totalWords = p.snippets.reduce((n, s) => n + wordCount(s.text), 0);
  $('wordTotal').textContent = totalWords ? `${totalWords} words` : '';

  if (p.snippets.length === 0) {
    const note = document.createElement('div');
    note.className = 'empty-note';
    note.innerHTML = 'No snippets yet.<br>Select text on any page and save it.';
    list.appendChild(note);
    return;
  }

  p.snippets.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'snippet';

    const text = document.createElement('div');
    text.className = 'snippet-text';
    text.textContent = s.text;
    text.title = s.text;

    const meta = document.createElement('div');
    meta.className = 'snippet-meta';

    const src = document.createElement('div');
    src.className = 'snippet-src';
    src.textContent = s.title || s.url || 'Unknown source';
    src.title = `${s.title || ''}\n${s.url || ''}`;

    const actions = document.createElement('div');
    actions.className = 'snippet-actions';

    const up = btn('M18 15l-6-6-6 6', 'Move up', i === 0);
    up.addEventListener('click', () => moveSnippet(i, -1));
    const down = btn('M6 9l6 6 6-6', 'Move down', i === p.snippets.length - 1);
    down.addEventListener('click', () => moveSnippet(i, 1));
    const del = btn('M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'Delete', false);
    del.classList.add('danger');
    del.addEventListener('click', async () => {
      p.snippets.splice(i, 1);
      await persist();
      render();
    });

    actions.append(up, down, del);
    meta.append(src, actions);
    card.append(text, meta);
    list.appendChild(card);
  });
}

/** Small stroke icon button factory. */
function btn(pathD, title, disabled) {
  const b = document.createElement('button');
  b.className = 'icon-btn';
  b.title = title;
  b.disabled = !!disabled;
  b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${esc(pathD)}"/></svg>`;
  return b;
}

async function moveSnippet(i, dir) {
  const p = activeProject();
  const j = i + dir;
  if (j < 0 || j >= p.snippets.length) return;
  [p.snippets[i], p.snippets[j]] = [p.snippets[j], p.snippets[i]];
  await persist();
  render();
}

// ---------- sources ----------
function renderSources() {
  const p = activeProject();
  const box = $('sourceList');
  box.innerHTML = '';
  const seen = new Map();
  p.snippets.forEach((s) => {
    if (!s.url || seen.has(s.url)) return;
    seen.set(s.url, s.title || s.url);
  });
  if (seen.size === 0) {
    box.innerHTML = '<div class="source-item">No sources yet.</div>';
    return;
  }
  seen.forEach((title, url) => {
    const div = document.createElement('div');
    div.className = 'source-item';
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = title;
    a.title = url;
    div.appendChild(a);
    box.appendChild(div);
  });
}

// ---------- compile & export ----------
function compileMarkdown() {
  const p = activeProject();
  const lines = [`# ${p.name}`, '', `_Compiled ${new Date().toLocaleString()} — ${p.snippets.length} snippet(s)_`, ''];
  p.snippets.forEach((s, i) => {
    lines.push(`## ${i + 1}. ${s.title || 'Untitled source'}`, '');
    lines.push(s.text, '');
    if (s.url) lines.push(`> Source: ${s.url}`, '');
  });
  lines.push('---', '', 'Compiled with SnippetStack.');
  return lines.join('\n');
}

function compileText() {
  const p = activeProject();
  const lines = [`${p.name}`, `Compiled ${new Date().toLocaleString()} — ${p.snippets.length} snippet(s)`, ''];
  p.snippets.forEach((s, i) => {
    lines.push(`[${i + 1}] ${s.title || 'Untitled source'}`, s.text);
    if (s.url) lines.push(`Source: ${s.url}`);
    lines.push('');
  });
  return lines.join('\n');
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const safeName = (n) => (n || 'project').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'project';

$('exportMdBtn').addEventListener('click', () => {
  const p = activeProject();
  if (!p.snippets.length) return flash('Nothing to export — save a snippet first.', false);
  downloadFile(compileMarkdown(), safeName(p.name) + '.md', 'text/markdown');
  flash('Markdown exported.', true);
});

$('exportTxtBtn').addEventListener('click', () => {
  const p = activeProject();
  if (!p.snippets.length) return flash('Nothing to export — save a snippet first.', false);
  downloadFile(compileText(), safeName(p.name) + '.txt', 'text/plain');
  flash('Text file exported.', true);
});

$('copyBtn').addEventListener('click', async () => {
  const p = activeProject();
  if (!p.snippets.length) return flash('Nothing to copy — save a snippet first.', false);
  try {
    await navigator.clipboard.writeText(compileMarkdown());
    flash('Compiled summary copied.', true);
  } catch (_) {
    flash('Copy failed — clipboard unavailable.', false);
  }
});

// ---------- capture ----------
function flash(msg, ok) {
  const el = $('captureStatus');
  el.textContent = msg;
  el.className = 'status ' + (ok ? 'ok' : 'err');
  setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 2500);
}

$('grabBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'grab-selection' }, async (res) => {
    if (chrome.runtime.lastError || !res) return flash('Could not reach the page.', false);
    if (res.ok) {
      await load(); // re-read storage (background added the snippet)
      flash('Selection saved.', true);
    } else {
      flash(res.error || 'Nothing to save.', false);
    }
  });
});

// ---------- render ----------
function render() {
  renderProjectSelect();
  renderSnippets();
  renderSources();
}

load();
