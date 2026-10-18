// ISBN Wishlist — engine: ISBN validation, entry CRUD, search, Open Library links.
// Honest scope: your wishlist — not live availability data.
// ============ ENGINE-START ============
const OL_SEARCH = 'https://openlibrary.org/search?q=';

/** Strip hyphens/spaces; return cleaned ISBN string. */
function cleanIsbn(raw) {
  return String(raw == null ? '' : raw).replace(/[-\s]/g, '');
}

/** Validate ISBN-10 or ISBN-13 with check digit. Returns true/false. */
function isValidIsbn(raw) {
  const s = cleanIsbn(raw);
  if (/^\d{9}[\dX]$/i.test(s)) {
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += (10 - i) * Number(s[i]);
    const check = s[9].toUpperCase() === 'X' ? 10 : Number(s[9]);
    return (sum + check) % 11 === 0;
  }
  if (/^\d{13}$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10 === Number(s[12]);
  }
  return false;
}

/** Build a validated book entry object. Returns entry or null on invalid input. */
function makeBook(isbn, title, author, notes) {
  const clean = cleanIsbn(isbn);
  if (!isValidIsbn(clean)) return null;
  const t = String(title || '').trim().slice(0, 120);
  if (!t) return null;
  return {
    isbn: clean,
    title: t,
    author: String(author || '').trim().slice(0, 120),
    notes: String(notes || '').trim().slice(0, 200),
    addedAt: Date.now(),
  };
}

/** Sort books newest-first (immutable). */
function sortBooks(books) {
  return [...books].sort((a, b) => b.addedAt - a.addedAt);
}

/** Case-insensitive filter across title/author/ISBN/notes. Empty query returns all. */
function filterBooks(books, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [...books];
  return books.filter(b =>
    b.title.toLowerCase().includes(q) ||
    b.author.toLowerCase().includes(q) ||
    b.isbn.includes(q) ||
    b.notes.toLowerCase().includes(q));
}

/** Open Library search URL for an ISBN. */
function olUrl(isbn) {
  return OL_SEARCH + encodeURIComponent(isbn);
}

/** Escape HTML for safe rendering. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// ============ ENGINE-END ============

const $ = id => document.getElementById(id);
let books = [];

/** Persist books to storage. */
function save() { chrome.storage.local.set({ books }); }

/** Render the book list for the current search query. */
function render() {
  const list = sortBooks(filterBooks(books, $('f-search').value));
  const ul = $('books');
  ul.innerHTML = '';
  $('count').textContent = books.length;
  $('empty').hidden = books.length !== 0;
  for (const b of list) {
    const li = document.createElement('li');
    li.className = 'book';
    li.innerHTML =
      '<div class="t">' + esc(b.title) + '</div>' +
      (b.author ? '<div class="a">by ' + esc(b.author) + '</div>' : '') +
      '<div class="isbn">ISBN ' + esc(b.isbn) + '</div>' +
      (b.notes ? '<div class="n">' + esc(b.notes) + '</div>' : '') +
      '<div class="row">' +
      '<a href="' + olUrl(b.isbn) + '" target="_blank" rel="noopener">Open Library search</a>' +
      '<button data-isbn="' + esc(b.isbn) + '">Delete</button>' +
      '</div>';
    ul.appendChild(li);
  }
  ul.querySelectorAll('button[data-isbn]').forEach(btn => {
    btn.addEventListener('click', () => {
      books = books.filter(b => b.isbn !== btn.dataset.isbn);
      save(); render();
    });
  });
}

function showErr(msg) { const e = $('err'); e.textContent = msg; e.hidden = !msg; }

function init() {
  chrome.storage.local.get({ books: [] }, data => { books = data.books; render(); });
  $('btn-add').addEventListener('click', () => {
    const entry = makeBook($('f-isbn').value, $('f-title').value, $('f-author').value, $('f-notes').value);
    if (!entry) { showErr('Enter a valid ISBN-10/ISBN-13 and a title.'); return; }
    if (books.some(b => b.isbn === entry.isbn)) { showErr('That ISBN is already on your list.'); return; }
    books.push(entry); save(); render(); showErr('');
    $('f-isbn').value = ''; $('f-title').value = ''; $('f-author').value = ''; $('f-notes').value = '';
  });
  $('f-search').addEventListener('input', render);
  $('btn-clear').addEventListener('click', () => {
    if (!books.length || !confirm('Remove all books from your wishlist?')) return;
    books = []; save(); render();
  });
}
init();
