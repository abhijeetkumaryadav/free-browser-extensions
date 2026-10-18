// ============================================================================
// Media Ownership Tree — popup logic
// Educational explainer + the user's own parent/child organization notes,
// stored locally in chrome.storage.local. No built-in data, no network.
// ============================================================================

// ENGINE-START
// --- Pure, headless-testable engine ----------------------------------------

const ROLES = ['outlet', 'publisher', 'parent', 'owner'];

/** Create a tree node. Returns null when name is empty or role invalid. */
function makeNode(name, role, parentName, note) {
  const nm = (name || '').trim().slice(0, 80);
  if (!nm || !ROLES.includes(role)) return null;
  return {
    id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name: nm,
    role,
    parent: (parentName || '').trim().slice(0, 80),
    note: (note || '').trim().slice(0, 200),
    at: Date.now()
  };
}

/** Newest-first, immutable sort. */
function sortNodes(nodes) {
  return [...nodes].sort((a, b) => b.at - a.at);
}

/** Case-insensitive search across name, parent, and note. */
function filterNodes(nodes, q) {
  const needle = (q || '').trim().toLowerCase();
  if (!needle) return [...nodes];
  return nodes.filter((n) =>
    n.name.toLowerCase().includes(needle) ||
    n.parent.toLowerCase().includes(needle) ||
    n.note.toLowerCase().includes(needle));
}

/** Count nodes per role. */
function roleCounts(nodes) {
  const counts = { outlet: 0, publisher: 0, parent: 0, owner: 0 };
  for (const n of nodes) if (counts[n.role] !== undefined) counts[n.role]++;
  return counts;
}
// ENGINE-END

// --- UI wiring -------------------------------------------------------------

const $ = (id) => document.getElementById(id);

function loadNodes(cb) {
  chrome.storage.local.get(['orgs'], (res) => cb(Array.isArray(res.orgs) ? res.orgs : []));
}
function saveNodes(nodes, cb) {
  chrome.storage.local.set({ orgs: nodes }, () => cb && cb());
}

function render() {
  loadNodes((nodes) => {
    const tree = $('tree');
    const items = sortNodes(filterNodes(nodes, $('q').value));
    $('clear').classList.toggle('hidden', nodes.length === 0);
    if (!items.length) {
      tree.innerHTML = '<div class="empty">' +
        (nodes.length ? 'No matches.' : 'No organizations yet. Add your first above.') + '</div>';
      return;
    }
    tree.innerHTML = '';
    for (const n of items) {
      const div = document.createElement('div');
      div.className = 'node';
      const del = document.createElement('button');
      del.className = 'del';
      del.title = 'Delete';
      del.textContent = '×';
      del.addEventListener('click', () => {
        saveNodes(nodes.filter((x) => x.id !== n.id), render);
      });
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = n.name;
      const role = document.createElement('span');
      role.className = 'role';
      role.textContent = n.role;
      div.appendChild(nm);
      div.appendChild(role);
      div.appendChild(del);
      if (n.parent) {
        const p = document.createElement('div');
        p.className = 'par';
        p.textContent = '↳ owned by ' + n.parent;
        div.appendChild(p);
      }
      if (n.note) {
        const nt = document.createElement('div');
        nt.className = 'nt';
        nt.textContent = n.note;
        div.appendChild(nt);
      }
      tree.appendChild(div);
    }
  });
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    $('tab-learn').classList.toggle('hidden', tab.dataset.tab !== 'learn');
    $('tab-tree').classList.toggle('hidden', tab.dataset.tab !== 'tree');
  });
});

$('add').addEventListener('click', () => {
  const node = makeNode($('orgName').value, $('orgRole').value, $('orgParent').value, $('orgNote').value);
  if (!node) {
    $('orgName').focus();
    return;
  }
  loadNodes((nodes) => {
    nodes.push(node);
    saveNodes(nodes, () => {
      $('orgName').value = '';
      $('orgParent').value = '';
      $('orgNote').value = '';
      render();
    });
  });
});

$('q').addEventListener('input', render);

$('clear').addEventListener('click', () => {
  if (confirm('Delete all your organization notes?')) saveNodes([], render);
});

render();
