// Indie Search Tunnel — one query, launched on the indie engines you pick.
// No scraping, no aggregation: just chrome.tabs.create with each engine's search URL.

const $ = (id) => document.getElementById(id);

// Bundled indie / non-commercial engines. {q} = URL-encoded query.
const BUILT_IN = [
  { name: 'Marginalia', url: 'https://search.marginalia.nu/search?query={q}', builtin: true },
  { name: 'Wiby', url: 'https://wiby.me/?q={q}', builtin: true },
  { name: 'Mojeek', url: 'https://www.mojeek.com/search?q={q}', builtin: true },
  { name: 'LiteDuck', url: 'https://lite.duckduckgo.com/lite/?q={q}', builtin: true },
];

const CUSTOM_KEY = 'ist_custom';
const SELECTED_KEY = 'ist_selected';

/** Load custom engines + which engines are ticked. */
async function loadState() {
  const data = await chrome.storage.local.get([CUSTOM_KEY, SELECTED_KEY]);
  const custom = Array.isArray(data[CUSTOM_KEY]) ? data[CUSTOM_KEY] : [];
  const engines = [...BUILT_IN, ...custom];
  let selected = data[SELECTED_KEY];
  if (!Array.isArray(selected)) selected = engines.map((e) => e.name);
  return { engines, custom, selected };
}

async function saveState(patch) {
  await chrome.storage.local.set(patch);
}

/** Render engine checkbox list. */
function renderEngines(engines, selected) {
  const list = $('engineList');
  list.innerHTML = '';
  for (const eng of engines) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selected.includes(eng.name);
    cb.dataset.name = eng.name;
    const span = document.createElement('span');
    span.textContent = eng.name;
    label.appendChild(cb); label.appendChild(span);
    li.appendChild(label);
    if (!eng.builtin) {
      const del = document.createElement('button');
      del.className = 'del'; del.title = 'Remove engine'; del.textContent = '×';
      del.dataset.name = eng.name;
      li.appendChild(del);
    }
    list.appendChild(li);
  }
}

function readSelected() {
  return [...document.querySelectorAll('#engineList input[type="checkbox"]:checked')]
    .map((cb) => cb.dataset.name);
}

async function main() {
  let { engines, custom, selected } = await loadState();
  renderEngines(engines, selected);

  $('allBtn').addEventListener('click', () => {
    document.querySelectorAll('#engineList input[type="checkbox"]').forEach((cb) => { cb.checked = true; });
  });
  $('noneBtn').addEventListener('click', () => {
    document.querySelectorAll('#engineList input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
  });

  // Delegated remove for custom engines.
  $('engineList').addEventListener('click', async (e) => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    custom = custom.filter((c) => c.name !== btn.dataset.name);
    engines = engines.filter((en) => en.name !== btn.dataset.name);
    selected = selected.filter((n) => n !== btn.dataset.name);
    await saveState({ [CUSTOM_KEY]: custom, [SELECTED_KEY]: selected });
    renderEngines(engines, selected);
  });

  $('engineList').addEventListener('change', async () => {
    selected = readSelected();
    await saveState({ [SELECTED_KEY]: selected });
  });

  $('addBtn').addEventListener('click', async () => {
    const name = $('newName').value.trim();
    const url = $('newUrl').value.trim();
    if (!name || !url || !url.includes('{q}')) return;
    if (engines.some((e) => e.name.toLowerCase() === name.toLowerCase())) return;
    const eng = { name, url };
    custom.push(eng); engines.push(eng); selected.push(name);
    await saveState({ [CUSTOM_KEY]: custom, [SELECTED_KEY]: selected });
    renderEngines(engines, selected);
    $('newName').value = ''; $('newUrl').value = '';
  });

  async function launch() {
    const q = $('query').value.trim();
    if (!q) { $('query').focus(); return; }
    const names = readSelected();
    const picked = engines.filter((e) => names.includes(e.name));
    if (picked.length === 0) return;
    for (const eng of picked) {
      const url = eng.url.replace('{q}', encodeURIComponent(q));
      await chrome.tabs.create({ url, active: false });
    }
    await saveState({ [SELECTED_KEY]: names });
    window.close(); // tidy: popup closes after launching
  }

  $('launchBtn').addEventListener('click', launch);
  $('query').addEventListener('keydown', (e) => { if (e.key === 'Enter') launch(); });
}

main();
