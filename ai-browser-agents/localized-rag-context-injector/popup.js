'use strict';

/* =====================================================================
 * ContextVault — local context-snippet library ("RAG-style" UX only).
 * Honest scope: a snippet manager with tags + search + one-click insert.
 * No embeddings, no vector database, no network. Everything on-device.
 * ===================================================================== */

const STORE_KEY = 'contextvault_snippets';

/* --- Self-contained page function --------------------------------------
 * Runs in the PAGE's isolated world via chrome.scripting.executeScript.
 * Must not reference anything outside its own body.
 */
function insertIntoActiveElement(text) {
  const el = document.activeElement;
  if (!el) return 'no-target';
  const tag = (el.tagName || '').toLowerCase();

  // Case 1: <textarea> or text <input> — insert at cursor
  if (tag === 'textarea' || (tag === 'input' && /^(text|search|url|email)$/.test(el.type || 'text'))) {
    try {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      el.setRangeText(text, start, end, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'inserted';
    } catch (e) {
      return 'no-target';
    }
  }

  // Case 2: contenteditable (rich editors, chat boxes)
  if (el.isContentEditable) {
    el.focus();
    const ok = document.execCommand('insertText', false, text);
    return ok ? 'inserted' : 'no-target';
  }

  return 'no-target';
}

/* --- State ------------------------------------------------------------- */

let snippets = [];       // [{id, name, tags[], content, createdAt, updatedAt}]
let editingId = null;    // id being edited, or null for "new"
let activeTag = null;    // tag filter
let toastTimer = null;

const $ = (id) => document.getElementById(id);

/* --- Storage ----------------------------------------------------------- */

async function loadSnippets() {
  try {
    const data = await chrome.storage.local.get(STORE_KEY);
    snippets = Array.isArray(data[STORE_KEY]) ? data[STORE_KEY] : [];
  } catch {
    snippets = [];
  }
}

async function saveSnippets() {
  try {
    await chrome.storage.local.set({ [STORE_KEY]: snippets });
  } catch (err) {
    toast('Could not save (storage error)');
  }
}

/* --- Helpers ----------------------------------------------------------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parseTags(raw) {
  return raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}

function allTags() {
  const set = new Set();
  for (const s of snippets) for (const t of s.tags) set.add(t);
  return [...set].sort();
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

function snippetMatches(s, query) {
  const q = query.trim().toLowerCase();
  if (activeTag && !s.tags.includes(activeTag)) return false;
  if (!q) return true;
  return (
    s.name.toLowerCase().includes(q) ||
    s.content.toLowerCase().includes(q) ||
    s.tags.some((t) => t.includes(q))
  );
}

/* --- Rendering --------------------------------------------------------- */

function renderTags() {
  const bar = $('tagBar');
  bar.innerHTML = '';
  for (const tag of allTags()) {
    const chip = document.createElement('button');
    chip.className = 'tag-chip' + (activeTag === tag ? ' active' : '');
    chip.textContent = tag;
    chip.title = activeTag === tag ? 'Clear tag filter' : `Filter by "${tag}"`;
    chip.addEventListener('click', () => {
      activeTag = activeTag === tag ? null : tag;
      renderTags();
      renderList();
    });
    bar.appendChild(chip);
  }
}

function renderList() {
  const list = $('list');
  const empty = $('emptyList');
  list.innerHTML = '';

  const visible = snippets
    .filter((s) => snippetMatches(s, $('search').value))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  $('countLabel').textContent = `${visible.length} / ${snippets.length}`;
  empty.style.display = visible.length ? 'none' : '';

  for (const s of visible) {
    const card = document.createElement('div');
    card.className = 'snippet';

    const top = document.createElement('div');
    top.className = 'snippet-top';
    const name = document.createElement('span');
    name.className = 'snippet-name';
    name.textContent = s.name;
    name.title = s.name;
    const len = document.createElement('span');
    len.className = 'snippet-len';
    len.textContent = `${s.content.length.toLocaleString()} chars`;
    top.append(name, len);

    const tags = document.createElement('div');
    tags.className = 'snippet-tags';
    for (const t of s.tags) {
      const chip = document.createElement('span');
      chip.className = 't';
      chip.textContent = t;
      tags.appendChild(chip);
    }

    const preview = document.createElement('div');
    preview.className = 'snippet-preview';
    preview.textContent = s.content;

    const actions = document.createElement('div');
    actions.className = 'snippet-actions';

    const insertBtn = document.createElement('button');
    insertBtn.className = 'act insert';
    insertBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    insertBtn.append(document.createTextNode('Insert'));
    insertBtn.title = 'Insert into the focused field on the current tab (or copy to clipboard)';
    insertBtn.addEventListener('click', () => insertSnippet(s));

    const editBtn = document.createElement('button');
    editBtn.className = 'act';
    editBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
    editBtn.append(document.createTextNode('Edit'));
    editBtn.addEventListener('click', () => openForm(s.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'act danger';
    delBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
    delBtn.append(document.createTextNode('Delete'));
    // Two-click confirm: first click arms, second confirms
    delBtn.addEventListener('click', () => {
      if (delBtn.dataset.armed) {
        snippets = snippets.filter((x) => x.id !== s.id);
        saveSnippets().then(() => { renderTags(); renderList(); toast('Snippet deleted'); });
      } else {
        delBtn.dataset.armed = '1';
        delBtn.lastChild.textContent = 'Sure?';
        setTimeout(() => {
          delete delBtn.dataset.armed;
          delBtn.lastChild.textContent = 'Delete';
        }, 2500);
      }
    });

    actions.append(insertBtn, editBtn, delBtn);
    card.append(top, tags, preview, actions);
    list.appendChild(card);
  }
}

/* --- Form (add / edit) ------------------------------------------------- */

function openForm(id = null) {
  editingId = id;
  const s = id ? snippets.find((x) => x.id === id) : null;
  $('formTitle').textContent = s ? 'Edit snippet' : 'New snippet';
  $('fName').value = s ? s.name : '';
  $('fTags').value = s ? s.tags.join(', ') : '';
  $('fContent').value = s ? s.content : '';
  $('saveBtn').textContent = s ? 'Save changes' : 'Save snippet';
  $('formPanel').classList.remove('hidden');
  $('fName').focus();
}

function closeForm() {
  editingId = null;
  $('formPanel').classList.add('hidden');
  $('fName').value = '';
  $('fTags').value = '';
  $('fContent').value = '';
}

async function saveForm() {
  const name = $('fName').value.trim();
  const content = $('fContent').value;
  if (!name) { toast('Give the snippet a name'); $('fName').focus(); return; }
  if (!content.trim()) { toast('Snippet content is empty'); $('fContent').focus(); return; }

  const tags = parseTags($('fTags').value);
  const now = Date.now();

  if (editingId) {
    const s = snippets.find((x) => x.id === editingId);
    if (s) {
      s.name = name; s.tags = tags; s.content = content; s.updatedAt = now;
      toast('Snippet updated');
    }
  } else {
    snippets.push({ id: uid(), name, tags, content, createdAt: now, updatedAt: now });
    toast('Snippet saved');
  }
  await saveSnippets();
  closeForm();
  renderTags();
  renderList();
}

/* --- Insert flow ---------------------------------------------------------
 * 1. Try to inject into the focused editable element on the active tab.
 * 2. If no editable target (or injection impossible, e.g. chrome:// pages),
 *    copy to clipboard and tell the user to paste manually.
 */
async function insertSnippet(s) {
  let injected = false;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab && tab.url ? tab.url : '';
    const scriptable = /^https?:\/\//i.test(url) || /^\S+\.html$/i.test(url);

    if (tab && tab.id != null && scriptable) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: insertIntoActiveElement,
        args: [s.content],
      });
      injected = results && results[0] && results[0].result === 'inserted';
    }
  } catch (err) {
    // Injection failed (restricted page, no permission, etc.) — fall through
    injected = false;
  }

  if (injected) {
    toast('Inserted into the focused field');
  } else {
    try {
      await navigator.clipboard.writeText(s.content);
      toast('No editable field focused — copied, paste with Ctrl+V');
    } catch {
      toast('Could not insert or copy on this page');
    }
  }
}

/* --- Export / import --------------------------------------------------- */

function exportSnippets() {
  if (!snippets.length) { toast('Nothing to export'); return; }
  const blob = new Blob(
    [JSON.stringify({ app: 'contextvault', version: 1, snippets }, null, 2)],
    { type: 'application/json' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'contextvault-snippets.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast(`Exported ${snippets.length} snippet(s)`);
}

function importSnippets(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      const arr = Array.isArray(data) ? data : data.snippets;
      if (!Array.isArray(arr)) throw new Error('bad format');
      const existing = new Set(snippets.map((s) => s.id));
      let added = 0;
      for (const item of arr) {
        if (!item || typeof item.content !== 'string' || !item.content.trim()) continue;
        let id = typeof item.id === 'string' && item.id ? item.id : uid();
        if (existing.has(id)) id = uid(); // avoid collisions
        existing.add(id);
        snippets.push({
          id,
          name: String(item.name || 'Untitled').slice(0, 80),
          tags: Array.isArray(item.tags)
            ? item.tags.map(String).map((t) => t.trim().toLowerCase()).filter(Boolean)
            : [],
          content: item.content,
          createdAt: Number(item.createdAt) || Date.now(),
          updatedAt: Number(item.updatedAt) || Date.now(),
        });
        added++;
      }
      await saveSnippets();
      renderTags();
      renderList();
      toast(added ? `Imported ${added} snippet(s)` : 'No valid snippets found');
    } catch {
      toast('Import failed — invalid JSON file');
    }
  };
  reader.readAsText(file);
}

/* --- Wire-up ----------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', async () => {
  await loadSnippets();
  renderTags();
  renderList();

  $('search').addEventListener('input', renderList);

  $('addToggle').addEventListener('click', () => {
    if ($('formPanel').classList.contains('hidden')) openForm();
    else closeForm();
  });
  $('saveBtn').addEventListener('click', saveForm);
  $('cancelBtn').addEventListener('click', closeForm);

  $('exportBtn').addEventListener('click', exportSnippets);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) importSnippets(e.target.files[0]);
    e.target.value = '';
  });

  // Ctrl/Cmd+Enter in the content box saves the form
  $('fContent').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveForm();
    }
  });
});
