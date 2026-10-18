// Thermal & Soaring Guide — site/thermal notes log.
// Engine: pure functions between markers (headless-testable).
// ===================== ENGINE-START =====================
const STARS = ['★','★★','★★★','★★★★','★★★★★'];

/** Validate a site entry. Returns null when invalid. */
function makeSite(name, notes, rating) {
  const n = String(name || '').trim();
  const r = Number(rating);
  if (!n || n.length > 60) return null;
  if (!Number.isInteger(r) || r < 1 || r > 5) return null;
  return { id: 's' + Date.now() + Math.floor(Math.random() * 1e4),
           name: n, notes: String(notes || '').trim().slice(0, 500),
           rating: r, created: Date.now() };
}

/** Sort sites newest-first; does not mutate. */
function sortSites(sites) {
  return [...sites].sort((a, b) => b.created - a.created);
}

/** Filter sites by query (name or notes, case-insensitive). */
function filterSites(sites, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return sites;
  return sites.filter(s => s.name.toLowerCase().includes(needle) ||
                           s.notes.toLowerCase().includes(needle));
}

/** Average rating, 1 decimal, or null when empty. */
function avgRating(sites) {
  if (!sites.length) return null;
  return Math.round((sites.reduce((a, s) => a + s.rating, 0) / sites.length) * 10) / 10;
}

/** Highest-rated site (first on ties), or null. */
function topSite(sites) {
  if (!sites.length) return null;
  return [...sites].sort((a, b) => b.rating - a.rating || b.created - a.created)[0];
}

/** Format a timestamp as short date. */
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
// ===================== ENGINE-END =====================

const $ = id => document.getElementById(id);
const KEY = 'soaringSites';

// ---- Tabs ----
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('tab-learn').classList.toggle('hidden', btn.dataset.tab !== 'learn');
    $('tab-sites').classList.toggle('hidden', btn.dataset.tab !== 'sites');
  });
});

async function load() {
  const { [KEY]: sites = [] } = await chrome.storage.local.get(KEY);
  return sites;
}
async function save(sites) { await chrome.storage.local.set({ [KEY]: sites }); }

// ---- Form ----
$('siteForm').addEventListener('submit', async e => {
  e.preventDefault();
  const site = makeSite($('siteName').value, $('siteNotes').value, $('siteRating').value);
  if (!site) return;
  const sites = await load();
  sites.push(site);
  await save(sites);
  $('siteName').value = ''; $('siteNotes').value = '';
  render();
});

// ---- Search + render ----
$('search').addEventListener('input', render);

async function render() {
  const sites = sortSites(await load());
  const q = $('search').value;
  const shown = filterSites(sites, q);

  $('siteCount').textContent = sites.length;
  $('statCount').textContent = sites.length;
  const avg = avgRating(sites);
  $('statAvg').textContent = avg === null ? '—' : avg.toFixed(1);
  const top = topSite(sites);
  $('statBest').textContent = top ? (top.name.length > 12 ? top.name.slice(0, 12) + '…' : top.name) : '—';

  const ul = $('siteList');
  ul.innerHTML = '';
  if (!shown.length) {
    ul.innerHTML = '<li class="empty">' + (sites.length ? 'No matches.' : 'No sites yet — log your first one above.') + '</li>';
    return;
  }
  for (const s of shown) {
    const li = document.createElement('li');
    li.innerHTML = '<div class="top"><span class="name"></span><span class="stars"></span></div>' +
      (s.notes ? '<div class="notes"></div>' : '') +
      '<div class="meta"><span></span><button class="del">delete</button></div>';
    li.querySelector('.name').textContent = s.name;
    li.querySelector('.stars').textContent = STARS[s.rating - 1];
    if (s.notes) li.querySelector('.notes').textContent = s.notes;
    li.querySelector('.meta span').textContent = fmtDate(s.created);
    li.querySelector('.del').addEventListener('click', async () => {
      const all = await load();
      await save(all.filter(x => x.id !== s.id));
      render();
    });
    ul.appendChild(li);
  }
}

$('clearAll').addEventListener('click', async () => {
  if (confirm('Delete all logged sites?')) { await save([]); render(); }
});

render();
