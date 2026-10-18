/* Ad Network Ownership Tree — popup logic.
 * Loads bundled static data, merges user edits from storage, renders an
 * interactive searchable tree. 100% local. */
const $ = (id) => document.getElementById(id);
const STORE_KEY = 'adOwnershipTreeEdits';

function findNode(tree, name) {
  const target = name.trim().toLowerCase();
  for (const n of tree) {
    if (n.name.toLowerCase() === target) return n;
    const found = (n.children || []).find((c) => c.name.toLowerCase() === target);
    if (found) return found;
  }
  return null;
}

function upsert(tree, entry) {
  const existing = findNode(tree, entry.name);
  if (existing) {
    if (entry.kind) existing.kind = entry.kind;
    if (entry.note !== undefined) existing.note = entry.note;
    return;
  }
  const node = {
    name: entry.name,
    kind: entry.kind || 'Entry',
    note: entry.note || '',
    children: []
  };
  const parent = entry.parent ? findNode(tree, entry.parent) : null;
  if (parent) {
    parent.children = parent.children || [];
    parent.children.push(node);
  } else {
    tree.push(node);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function highlight(text, q) {
  if (!q) return escapeHtml(text);
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return escapeHtml(text);
  return escapeHtml(text.slice(0, idx)) + '<mark>' +
    escapeHtml(text.slice(idx, idx + q.length)) + '</mark>' +
    escapeHtml(text.slice(idx + q.length));
}

function matches(node, q) {
  const t = q.toLowerCase();
  return node.name.toLowerCase().includes(t) ||
    (node.kind || '').toLowerCase().includes(t) ||
    (node.note || '').toLowerCase().includes(t);
}

function render(tree, query) {
  const box = $('tree');
  box.innerHTML = '';
  const q = (query || '').trim();
  let anyVisible = false;

  tree.forEach((parent) => {
    const parentMatch = !q || matches(parent, q);
    const childMatches = q
      ? (parent.children || []).filter((c) => matches(c, q))
      : (parent.children || []);
    if (q && !parentMatch && childMatches.length === 0) return;
    anyVisible = true;

    const pEl = document.createElement('div');
    pEl.className = 'node';
    pEl.setAttribute('role', 'treeitem');
    pEl.innerHTML =
      '<button class="n-del" data-name="' + escapeHtml(parent.name) + '" title="Remove">×</button>' +
      '<span class="n-name">' + highlight(parent.name, q) + '</span>' +
      (parent.kind ? '<span class="n-kind">' + highlight(parent.kind, q) + '</span>' : '') +
      (parent.note ? '<div class="n-note">' + highlight(parent.note, q) + '</div>' : '');
    box.appendChild(pEl);

    childMatches.forEach((child) => {
      const cEl = document.createElement('div');
      cEl.className = 'node child';
      cEl.setAttribute('role', 'treeitem');
      cEl.innerHTML =
        '<button class="n-del" data-name="' + escapeHtml(child.name) + '" title="Remove">×</button>' +
        '<span class="n-name">' + highlight(child.name, q) + '</span>' +
        (child.kind ? '<span class="n-kind">' + highlight(child.kind, q) + '</span>' : '') +
        (child.note ? '<div class="n-note">' + highlight(child.note, q) + '</div>' : '');
      box.appendChild(cEl);
    });
  });

  $('noResults').classList.toggle('hidden', anyVisible);

  box.querySelectorAll('.n-del').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeEntry(btn.dataset.name);
    });
  });
}

async function removeEntry(name) {
  const { [STORE_KEY]: edits = [] } = await chrome.storage.local.get(STORE_KEY);
  // Record a tombstone so bundled entries stay hidden too.
  edits.push({ name, _deleted: true });
  await chrome.storage.local.set({ [STORE_KEY]: edits });
  await refresh();
}

// Rebuild the tree, honoring deletions recorded in the edit log.
async function loadTreeWithDeletes() {
  const { [STORE_KEY]: edits = [] } = await chrome.storage.local.get(STORE_KEY);
  const deleted = new Set(
    edits.filter((e) => e._deleted).map((e) => e.name.toLowerCase())
  );
  const tree = JSON.parse(JSON.stringify(AD_TREE))
    .filter((n) => !deleted.has(n.name.toLowerCase()))
    .map((n) => ({
      ...n,
      children: (n.children || []).filter((c) => !deleted.has(c.name.toLowerCase()))
    }));
  edits.filter((e) => !e._deleted).forEach((e) => upsert(tree, e));
  return tree;
}

let currentTree = [];
async function refresh() {
  currentTree = await loadTreeWithDeletes();
  render(currentTree, $('search').value);
}

$('search').addEventListener('input', () => render(currentTree, $('search').value));

$('saveBtn').addEventListener('click', async () => {
  const name = $('editName').value.trim();
  if (!name) return;
  const entry = {
    name,
    kind: $('editKind').value.trim(),
    note: $('editNote').value.trim(),
    parent: $('editParent').value.trim()
  };
  const { [STORE_KEY]: edits = [] } = await chrome.storage.local.get(STORE_KEY);
  edits.push(entry);
  await chrome.storage.local.set({ [STORE_KEY]: edits });
  ['editName', 'editKind', 'editNote', 'editParent'].forEach((id) => { $(id).value = ''; });
  await refresh();
});

$('resetBtn').addEventListener('click', async () => {
  await chrome.storage.local.remove(STORE_KEY);
  await refresh();
});

refresh();
