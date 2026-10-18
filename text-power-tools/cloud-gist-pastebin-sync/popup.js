/* SnippetVault — local-only snippet library.
 * Honest scope: there is NO cloud sync. "Share prep" only formats a snippet
 * so the user can paste it manually into gist.github.com / pastebin.com.
 * All data lives in chrome.storage.local. Zero network calls. */

const STORAGE_KEY = 'snippetvault.snippets.v1';

const $ = (id) => document.getElementById(id);
const listEl = $('list'), editorEl = $('editor'), searchEl = $('search');
const fldName = $('fldName'), fldLang = $('fldLang'), fldTags = $('fldTags'), fldBody = $('fldBody');

let snippets = [];       // [{id, name, lang, tags:[], body, updatedAt}]
let editingId = null;    // null => creating
let query = '';

const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- persistence ---------- */
async function load() {
  const { [STORAGE_KEY]: stored } = await chrome.storage.local.get(STORAGE_KEY);
  snippets = Array.isArray(stored) ? stored : [];
  render();
}
async function save() {
  await chrome.storage.local.set({ [STORAGE_KEY]: snippets });
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1800);
}

/* ---------- editor ---------- */
function openEditor(snippet) {
  editingId = snippet ? snippet.id : null;
  $('editorTitle').textContent = snippet ? 'Edit snippet' : 'New snippet';
  fldName.value = snippet ? snippet.name : '';
  fldLang.value = snippet ? snippet.lang : 'javascript';
  fldTags.value = snippet ? snippet.tags.join(', ') : '';
  fldBody.value = snippet ? snippet.body : '';
  editorEl.classList.remove('hidden');
  fldName.focus();
  editorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function closeEditor() {
  editorEl.classList.add('hidden');
  editingId = null;
}

$('btnAdd').addEventListener('click', () => openEditor(null));
$('btnCancel').addEventListener('click', closeEditor);

$('btnSave').addEventListener('click', async () => {
  const name = fldName.value.trim() || 'Untitled snippet';
  const body = fldBody.value;
  if (!body.trim()) { toast('Snippet body is empty'); return; }
  const tags = fldTags.value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 12);
  const lang = fldLang.value;
  if (editingId) {
    const s = snippets.find(s => s.id === editingId);
    if (s) Object.assign(s, { name, lang, tags, body, updatedAt: Date.now() });
    toast('Snippet updated');
  } else {
    snippets.unshift({ id: uid(), name, lang, tags, body, updatedAt: Date.now() });
    toast('Snippet saved');
  }
  await save();
  closeEditor();
  render();
});

/* ---------- search ---------- */
searchEl.addEventListener('input', () => { query = searchEl.value.trim().toLowerCase(); render(); });
function matches(s) {
  if (!query) return true;
  return s.name.toLowerCase().includes(query) ||
         s.lang.toLowerCase().includes(query) ||
         s.body.toLowerCase().includes(query) ||
         s.tags.some(t => t.toLowerCase().includes(query));
}

/* ---------- list rendering ---------- */
function esc(s) { // safe text insertion helper
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const ICONS = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
};

function render() {
  const filtered = snippets.filter(matches);
  $('count').textContent = `${snippets.length} snippet${snippets.length === 1 ? '' : 's'}`;
  listEl.innerHTML = '';
  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>
        <p>${snippets.length ? 'No snippets match your search.' : 'No snippets yet.<br>Click <strong>New</strong> to save your first one.'}</p>
      </div>`;
    return;
  }
  for (const s of filtered) {
    const card = document.createElement('div');
    card.className = 'card';
    // Build safely: user content via textContent only.
    const head = document.createElement('div');
    head.className = 'card-head';
    const name = document.createElement('span');
    name.className = 'name'; name.textContent = s.name;
    const lang = document.createElement('span');
    lang.className = 'lang'; lang.textContent = s.lang;
    head.append(name, lang);

    const pre = document.createElement('pre');
    pre.textContent = s.body.length > 600 ? s.body.slice(0, 600) + '…' : s.body;

    card.append(head, pre);

    if (s.tags.length) {
      const tags = document.createElement('div');
      tags.className = 'tags';
      for (const t of s.tags) {
        const el = document.createElement('span');
        el.className = 'tag'; el.textContent = '#' + t;
        tags.append(el);
      }
      card.append(tags);
    }

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const mkBtn = (icon, label, fn, danger) => {
      const b = document.createElement('button');
      b.className = 'icon-btn' + (danger ? ' danger' : '');
      b.innerHTML = icon + '<span></span>';
      b.querySelector('span').textContent = label;
      b.addEventListener('click', fn);
      return b;
    };
    actions.append(
      mkBtn(ICONS.copy, 'Copy', async () => {
        await navigator.clipboard.writeText(s.body);
        toast('Copied to clipboard');
      }),
      mkBtn(ICONS.share, 'Share prep', () => openShare(s)),
      mkBtn(ICONS.edit, 'Edit', () => openEditor(s)),
      mkBtn(ICONS.del, 'Delete', async () => {
        if (!confirm(`Delete "${s.name}"?`)) return;
        snippets = snippets.filter(x => x.id !== s.id);
        await save(); render(); toast('Snippet deleted');
      }, true)
    );
    card.append(actions);
    listEl.append(card);
  }
}

/* ---------- share prep (local formatting only — user pastes manually) ---------- */
function openShare(s) {
  const block =
`# ${s.name}
# language: ${s.lang}
# saved locally with SnippetVault — paste manually into gist.github.com or pastebin.com

\`\`\`${s.lang}
${s.body}
\`\`\``;
  $('shareText').value = block;
  $('shareModal').classList.remove('hidden');
}
$('btnShareClose').addEventListener('click', () => $('shareModal').classList.add('hidden'));
$('btnShareCopy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('shareText').value);
  toast('Share block copied');
});
$('shareModal').addEventListener('click', (e) => {
  if (e.target === $('shareModal')) $('shareModal').classList.add('hidden');
});

/* ---------- export / import ---------- */
$('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'SnippetVault', version: 1, exportedAt: new Date().toISOString(), snippets }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'snippetvault-export.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Exported as JSON');
});

$('btnImport').addEventListener('click', () => $('fileImport').click());
$('fileImport').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const arr = Array.isArray(data) ? data : data.snippets;
    if (!Array.isArray(arr)) throw new Error('bad shape');
    let added = 0;
    for (const s of arr) {
      if (!s || typeof s.body !== 'string') continue;
      snippets.unshift({
        id: uid(),
        name: String(s.name || 'Imported snippet').slice(0, 80),
        lang: String(s.lang || 'text').slice(0, 30),
        tags: Array.isArray(s.tags) ? s.tags.map(String).slice(0, 12) : [],
        body: s.body.slice(0, 100000),
        updatedAt: Date.now(),
      });
      added++;
    }
    await save(); render();
    toast(`Imported ${added} snippet${added === 1 ? '' : 's'}`);
  } catch {
    toast('Import failed: invalid JSON');
  }
  e.target.value = '';
});

/* ---------- init ---------- */
load();
