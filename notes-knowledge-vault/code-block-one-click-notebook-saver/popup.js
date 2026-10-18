/* CodeVault — popup logic.
 * Tabs: "Scan page" (detect code blocks, save to a notebook) and
 * "Notebooks" (browse snippets, copy/delete, export Markdown).
 * All data lives in chrome.storage.local — nothing leaves the device.
 */
'use strict';

// ---- storage model ----
// books: [{ id, name, createdAt }]
// snippets: [{ id, bookId, code, language, url, title, createdAt }]

const store = {
  async getAll() {
    const d = await chrome.storage.local.get(['cv_books', 'cv_snippets']);
    return { books: d.cv_books || [], snippets: d.cv_snippets || [] };
  },
  async saveBooks(books) { await chrome.storage.local.set({ cv_books: books }); },
  async saveSnippets(snippets) { await chrome.storage.local.set({ cv_snippets: snippets }); }
};

function uid() {
  return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

let activeTab = null;
let pageSupported = false;
let openBookId = null;

// ---- page scanning ----

// Inject scanner.js into the page's MAIN world, then invoke it.
// (Two-step injection avoids eval/new Function, which MV3 CSP forbids.)
async function injectAndScan() {
  await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    files: ['scanner.js'],
    world: 'MAIN'
  });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    world: 'MAIN',
    func: () => window.codeVaultScan()
  });
  return result || [];
}

async function renderBlocks(blocks) {
  const resultsEl = document.getElementById('scanResults');
  const emptyEl = document.getElementById('scanEmpty');
  resultsEl.innerHTML = '';
  const { books } = await store.getAll();

  if (blocks.length === 0) {
    emptyEl.style.display = 'block';
    emptyEl.textContent = 'No code blocks found on this page.';
    return;
  }
  emptyEl.style.display = 'none';

  blocks.forEach((b, i) => {
    const card = document.createElement('div');
    card.className = 'block-card';
    const selectOpts = books.length
      ? books.map((bk) => `<option value="${bk.id}">${escapeHtml(bk.name)}</option>`).join('')
      : '<option value="">— create a notebook first —</option>';
    card.innerHTML =
      `<div class="block-meta"><span class="lang">${escapeHtml(b.language)}</span>` +
      `<span class="lines">${b.lines} lines</span></div>` +
      `<pre>${escapeHtml(b.preview)}${b.lines > 3 ? '\n…' : ''}</pre>` +
      `<div class="save-row"><select>${selectOpts}</select>` +
      `<button class="btn primary" ${books.length ? '' : 'disabled style="opacity:.4"'}>Save</button></div>`;
    const btn = card.querySelector('button');
    btn.addEventListener('click', async () => {
      const bookId = card.querySelector('select').value;
      if (!bookId) return;
      await saveSnippet(bookId, b);
      btn.textContent = 'Saved ✓';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = 'Save'; btn.disabled = false; }, 1200);
      renderBooks();
    });
    resultsEl.appendChild(card);
  });
}

async function saveSnippet(bookId, block) {
  const { snippets } = await store.getAll();
  snippets.push({
    id: uid(),
    bookId,
    code: block.code,
    language: block.language,
    url: activeTab.url || '',
    title: activeTab.title || '',
    createdAt: Date.now()
  });
  await store.saveSnippets(snippets);
}

// ---- notebooks ----

async function renderBooks() {
  const { books, snippets } = await store.getAll();
  document.getElementById('bookCount').textContent = books.length;
  const listEl = document.getElementById('bookList');
  const emptyEl = document.getElementById('bookEmpty');
  listEl.innerHTML = '';
  emptyEl.style.display = books.length ? 'none' : 'block';

  books.forEach((bk) => {
    const count = snippets.filter((s) => s.bookId === bk.id).length;
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML =
      `<div><div class="book-name">${escapeHtml(bk.name)}</div>` +
      `<div class="book-sub">${count} snippet${count === 1 ? '' : 's'}</div></div>` +
      `<span class="mini">Open →</span>`;
    card.addEventListener('click', () => openBook(bk.id));
    listEl.appendChild(card);
  });
}

async function openBook(bookId) {
  openBookId = bookId;
  const { books, snippets } = await store.getAll();
  const book = books.find((b) => b.id === bookId);
  if (!book) return;
  document.getElementById('detailTitle').textContent = book.name;
  document.getElementById('bookDetail').classList.remove('hidden');

  const listEl = document.getElementById('snippetList');
  listEl.innerHTML = '';
  const items = snippets.filter((s) => s.bookId === bookId);
  if (items.length === 0) {
    listEl.innerHTML = '<div class="empty">No snippets yet — scan a page and save code blocks here.</div>';
  }
  [...items].reverse().forEach((s) => {
    const el = document.createElement('div');
    el.className = 'snippet';
    let host = '';
    try { host = new URL(s.url).hostname; } catch (e) { /* ignore */ }
    el.innerHTML =
      `<div class="block-meta"><span class="lang">${escapeHtml(s.language)}</span>` +
      `<span class="lines">${s.code.split('\n').length} lines</span></div>` +
      `<pre>${escapeHtml(s.code.slice(0, 1200))}${s.code.length > 1200 ? '\n…[truncated in view]' : ''}</pre>` +
      (host ? `<div class="snippet-src" title="${escapeHtml(s.url)}">${escapeHtml(host)}</div>` : '') +
      `<div class="snippet-actions">` +
      `<button class="mini" data-act="copy">Copy</button>` +
      `<button class="mini del" data-act="del">Delete</button></div>`;
    el.querySelector('[data-act="copy"]').addEventListener('click', async (ev) => {
      await navigator.clipboard.writeText(s.code);
      ev.target.textContent = 'Copied ✓';
      setTimeout(() => { ev.target.textContent = 'Copy'; }, 1200);
    });
    el.querySelector('[data-act="del"]').addEventListener('click', async () => {
      const all = (await store.getAll()).snippets.filter((x) => x.id !== s.id);
      await store.saveSnippets(all);
      openBook(bookId);
      renderBooks();
    });
    listEl.appendChild(el);
  });
}

function bookMarkdown(book, items) {
  let md = `# ${book.name}\n\nExported ${new Date().toLocaleString()} — ${items.length} snippet(s)\n\n`;
  items.forEach((s, i) => {
    md += `## ${i + 1}. ${s.language}\n\n`;
    if (s.url) md += `Source: ${s.url}\n\n`;
    md += '```' + (s.language === 'text' ? '' : s.language) + '\n' + s.code + '\n```\n\n';
  });
  return md;
}

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportBook() {
  const { books, snippets } = await store.getAll();
  const book = books.find((b) => b.id === openBookId);
  if (!book) return;
  const items = snippets.filter((s) => s.bookId === openBookId);
  if (!items.length) return;
  download(
    book.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.md',
    bookMarkdown(book, items)
  );
}

// ---- init ----

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab || null;
  pageSupported = !!tab && /^https?:\/\//i.test(tab.url || '');
  document.getElementById('unsupported').classList.toggle('hidden', pageSupported);
  if (tab && tab.url) {
    try { document.getElementById('pageHost').textContent = new URL(tab.url).hostname; }
    catch (e) { /* keep default */ }
  }

  // Tabs
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.tab-page').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('tab-' + t.dataset.tab).classList.add('active');
      if (t.dataset.tab === 'books') {
        document.getElementById('bookDetail').classList.add('hidden');
        openBookId = null;
        renderBooks();
      }
    });
  });

  document.getElementById('scanBtn').addEventListener('click', async () => {
    if (!pageSupported) return;
    const btn = document.getElementById('scanBtn');
    const original = btn.innerHTML;
    btn.innerHTML = 'Scanning…';
    btn.disabled = true;
    try {
      const blocks = await injectAndScan();
      await renderBlocks(blocks);
    } catch (err) {
      document.getElementById('scanEmpty').style.display = 'block';
      document.getElementById('scanEmpty').textContent = 'Could not scan this page.';
    }
    btn.innerHTML = original;
    btn.disabled = false;
  });

  const addBook = async () => {
    const input = document.getElementById('newBookName');
    const name = input.value.trim();
    if (!name) return;
    const { books } = await store.getAll();
    books.push({ id: uid(), name, createdAt: Date.now() });
    await store.saveBooks(books);
    input.value = '';
    renderBooks();
  };
  document.getElementById('addBookBtn').addEventListener('click', addBook);
  document.getElementById('newBookName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBook();
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('bookDetail').classList.add('hidden');
    openBookId = null;
    renderBooks();
  });
  document.getElementById('exportBookBtn').addEventListener('click', exportBook);
  document.getElementById('deleteBookBtn').addEventListener('click', async () => {
    if (!openBookId || !confirm('Delete this notebook and all its snippets?')) return;
    const { books, snippets } = await store.getAll();
    await store.saveBooks(books.filter((b) => b.id !== openBookId));
    await store.saveSnippets(snippets.filter((s) => s.bookId !== openBookId));
    document.getElementById('bookDetail').classList.add('hidden');
    openBookId = null;
    renderBooks();
  });

  renderBooks();
}

document.addEventListener('DOMContentLoaded', init);
