/* Docs Search Router — popup logic.
 * Opens the user's query on each selected documentation source in a
 * background tab. It never performs the searches itself. */

const DEFAULT_SOURCES = [
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/search?q={q}', checked: true },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q={q}', checked: true },
  { name: 'DevDocs', url: 'https://devdocs.io/#q={q}', checked: true },
  { name: 'Python Docs', url: 'https://docs.python.org/3/search.html?q={q}', checked: false },
  { name: 'React Docs', url: 'https://react.dev/search?query={q}', checked: false },
];

const queryInput = document.getElementById('query');
const sourcesList = document.getElementById('sources');
const toggleAllBtn = document.getElementById('toggle-all');
const launchBtn = document.getElementById('launch');

/* ---------- storage ---------- */
async function getState() {
  const data = await chrome.storage.local.get({ sources: DEFAULT_SOURCES });
  return data.sources;
}
function saveState(sources) {
  return chrome.storage.local.set({ sources });
}

/* ---------- rendering ---------- */
function renderSources(sources) {
  sourcesList.innerHTML = '';
  sources.forEach((src, i) => {
    const li = document.createElement('li');
    if (src.custom) li.classList.add('custom');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!src.checked;
    box.addEventListener('change', () => { sources[i].checked = box.checked; saveState(sources); });
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = src.name;
    li.append(box, name);
    if (src.custom) {
      const del = document.createElement('button');
      del.className = 'del';
      del.title = 'Remove source';
      del.textContent = '×';
      del.addEventListener('click', () => {
        sources.splice(i, 1);
        saveState(sources).then(() => renderSources(sources));
      });
      li.appendChild(del);
    }
    sourcesList.appendChild(li);
  });
  const anyUnchecked = sources.some((s) => !s.checked);
  toggleAllBtn.textContent = anyUnchecked ? 'Select all' : 'Deselect all';
}

/* ---------- actions ---------- */
toggleAllBtn.addEventListener('click', async () => {
  const sources = await getState();
  const makeChecked = sources.some((s) => !s.checked);
  sources.forEach((s) => { s.checked = makeChecked; });
  await saveState(sources);
  renderSources(sources);
});

document.getElementById('src-add').addEventListener('click', async () => {
  const name = document.getElementById('src-name').value.trim();
  const url = document.getElementById('src-url').value.trim();
  if (!name || !url.includes('{q}')) return;
  const sources = await getState();
  sources.push({ name, url, checked: true, custom: true });
  await saveState(sources);
  document.getElementById('src-name').value = '';
  document.getElementById('src-url').value = '';
  renderSources(sources);
});

launchBtn.addEventListener('click', async () => {
  const q = queryInput.value.trim();
  if (!q) { queryInput.focus(); return; }
  const sources = await getState();
  const picked = sources.filter((s) => s.checked && s.url.includes('{q}'));
  if (!picked.length) return;
  const encoded = encodeURIComponent(q);
  for (const src of picked) {
    // Opens as a background tab; the site performs its own search there.
    await chrome.tabs.create({ url: src.url.replace('{q}', encoded), active: false });
  }
  window.close();
});

queryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') launchBtn.click();
});

/* ---------- init ---------- */
getState().then(renderSources);
queryInput.focus();
