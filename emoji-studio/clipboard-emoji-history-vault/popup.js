/* EmojiVault — Emoji History Vault (popup logic)
 * Honest scope: the vault ONLY records emoji copied from inside this extension
 * (picker clicks, or the explicit "Import from clipboard" button). Browsers do
 * not allow extensions to read the system clipboard in the background, so
 * nothing is ever captured silently — there is no clipboard snooping here.
 */
'use strict';

/* Curated picker dictionary: [emoji, name, category]. */
const EMOJI = [
  // Faces
  ['😀','grinning face','Faces'],['😁','beaming face','Faces'],['😂','joy','Faces'],
  ['🤣','rolling on the floor laughing','Faces'],['😊','smiling with smiling eyes','Faces'],
  ['😍','smiling with heart-eyes','Faces'],['😘','face blowing a kiss','Faces'],
  ['😎','smiling with sunglasses','Faces'],['🤔','thinking face','Faces'],
  ['😴','sleeping face','Faces'],['😭','loudly crying','Faces'],['😤','triumph','Faces'],
  ['🥳','partying face','Faces'],['🤯','exploding head','Faces'],['🥺','pleading face','Faces'],
  ['😇','smiling with halo','Faces'],['🤡','clown face','Faces'],
  // Gestures
  ['👍','thumbs up','Gestures'],['👎','thumbs down','Gestures'],['👏','clapping hands','Gestures'],
  ['🙌','raising hands','Gestures'],['👋','waving hand','Gestures'],['🤝','handshake','Gestures'],
  ['✌️','victory hand','Gestures'],['🤞','crossed fingers','Gestures'],['👌','OK hand','Gestures'],
  ['💪','flexed biceps','Gestures'],['🙏','folded hands','Gestures'],['✍️','writing hand','Gestures'],
  // Hearts & symbols
  ['❤️','red heart','Hearts'],['🧡','orange heart','Hearts'],['💛','yellow heart','Hearts'],
  ['💚','green heart','Hearts'],['💙','blue heart','Hearts'],['💜','purple heart','Hearts'],
  ['🖤','black heart','Hearts'],['🤍','white heart','Hearts'],['💔','broken heart','Hearts'],
  ['💕','two hearts','Hearts'],['💖','sparkling heart','Hearts'],['💯','hundred points','Hearts'],
  ['✨','sparkles','Hearts'],['🔥','fire','Hearts'],['⭐','star','Hearts'],
  // Animals
  ['🐶','dog','Animals'],['🐱','cat','Animals'],['🐭','mouse','Animals'],
  ['🐹','hamster','Animals'],['🐰','rabbit','Animals'],['🦊','fox','Animals'],
  ['🐻','bear','Animals'],['🐼','panda','Animals'],['🐨','koala','Animals'],
  ['🦁','lion','Animals'],['🐸','frog','Animals'],['🐵','monkey','Animals'],
  ['🐧','penguin','Animals'],['🦄','unicorn','Animals'],['🐝','bee','Animals'],
  ['🦋','butterfly','Animals'],['🐢','turtle','Animals'],['🐙','octopus','Animals'],
  ['🦈','shark','Animals'],['🐳','whale','Animals'],
  // Food
  ['🍕','pizza','Food'],['🍔','burger','Food'],['🍟','french fries','Food'],
  ['🌮','taco','Food'],['🍩','doughnut','Food'],['🍰','cake','Food'],
  ['🍫','chocolate bar','Food'],['🍿','popcorn','Food'],['🍦','ice cream','Food'],
  ['☕','coffee','Food'],['🍺','beer','Food'],['🍷','wine','Food'],
  ['🍎','red apple','Food'],['🍌','banana','Food'],['🍓','strawberry','Food'],
  ['🥑','avocado','Food'],['🍇','grapes','Food'],
  // Objects
  ['📱','mobile phone','Objects'],['💻','laptop','Objects'],['⌨️','keyboard','Objects'],
  ['📷','camera','Objects'],['🎮','video game','Objects'],['🎲','game die','Objects'],
  ['🎸','guitar','Objects'],['🎧','headphone','Objects'],['💡','light bulb','Objects'],
  ['🔑','key','Objects'],['🔒','locked','Objects'],['💰','money bag','Objects'],
  ['🎁','wrapped gift','Objects'],['🎈','balloon','Objects'],['📚','books','Objects'],
  ['✏️','pencil','Objects'],['📅','calendar','Objects'],['⏰','alarm clock','Objects'],
  // Travel
  ['🚗','car','Travel'],['✈️','airplane','Travel'],['🚀','rocket','Travel'],
  ['⛵','sailboat','Travel'],['🚲','bicycle','Travel'],['🏠','house','Travel'],
  ['🏖️','beach with umbrella','Travel'],['🗽','statue of liberty','Travel'],
  ['🗺️','world map','Travel'],['🧳','luggage','Travel'],
];
const CATS = ['All', ...new Set(EMOJI.map((e) => e[2]))];

/* DOM refs */
const search = document.getElementById('search');
const tabs = document.getElementById('tabs');
const grid = document.getElementById('grid');
const pickerCount = document.getElementById('pickerCount');
const vaultEl = document.getElementById('vault');
const vaultSearch = document.getElementById('vaultSearch');
const vaultCount = document.getElementById('vaultCount');
const importBtn = document.getElementById('importBtn');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');

const STORE_KEY = 'emojiVault';
const MAX_ENTRIES = 500;
let vault = [];       // [{ glyph, name, source, ts }]
let activeCat = 'All';

function setStatus(msg, isError) {
  status.textContent = msg;
  status.style.color = isError ? '#f87171' : '';
  if (msg) setTimeout(() => { if (status.textContent === msg) status.textContent = ''; }, 2600);
}

function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? 'Today ' + time : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
}

/* ---------- Storage ---------- */
async function loadVault() {
  try {
    const r = await chrome.storage.local.get([STORE_KEY]);
    vault = Array.isArray(r[STORE_KEY]) ? r[STORE_KEY] : [];
  } catch (e) { vault = []; }
}
async function saveVault() {
  try { await chrome.storage.local.set({ [STORE_KEY]: vault.slice(0, MAX_ENTRIES) }); } catch (e) {}
}

/* ---------- Logging ---------- */
async function logEmoji(glyph, name, source) {
  // De-dupe: move existing entry to top instead of duplicating.
  vault = vault.filter((e) => e.glyph !== glyph);
  vault.unshift({ glyph, name: name || 'emoji', source, ts: Date.now() });
  if (vault.length > MAX_ENTRIES) vault.length = MAX_ENTRIES;
  await saveVault();
  renderVault();
}

/* ---------- Copy helpers (Clipboard API + execCommand fallback) ---------- */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) {}
    ta.remove();
    return ok;
  }
}

/* ---------- Picker rendering ---------- */
function renderTabs() {
  tabs.innerHTML = '';
  CATS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'tab' + (c === activeCat ? ' active' : '');
    b.textContent = c;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => { activeCat = c; renderTabs(); renderGrid(); });
    tabs.appendChild(b);
  });
}

function renderGrid() {
  const q = search.value.trim().toLowerCase();
  const list = EMOJI.filter(([g, name, cat]) =>
    (activeCat === 'All' || cat === activeCat) &&
    (!q || name.includes(q) || g === q)
  );
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  list.forEach(([g, name]) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = g;
    b.title = name + ' — click to copy';
    b.setAttribute('aria-label', 'Copy ' + name);
    b.addEventListener('click', async () => {
      const ok = await copyText(g);
      if (ok) {
        await logEmoji(g, name, 'picker');
        setStatus('Copied ' + g + ' — logged to vault.');
      } else {
        setStatus('Copy failed — clipboard unavailable.', true);
      }
    });
    frag.appendChild(b);
  });
  grid.appendChild(frag);
  pickerCount.textContent = list.length + ' shown';
}

/* ---------- Vault rendering ---------- */
function renderVault() {
  const q = vaultSearch.value.trim().toLowerCase();
  const list = vault.filter((e) => !q || e.glyph === q || (e.name || '').toLowerCase().includes(q));
  vaultCount.textContent = vault.length + ' saved';
  clearBtn.disabled = !vault.length;
  vaultEl.innerHTML = '';
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'vault-empty';
    p.textContent = vault.length
      ? 'No matches — try a different search.'
      : 'Empty. Click an emoji above, or use “Import from clipboard”, and it will appear here.';
    vaultEl.appendChild(p);
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'entry';
    row.title = 'Click to copy ' + entry.glyph + ' again';

    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.textContent = entry.glyph;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = entry.name || 'emoji';
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = fmtTime(entry.ts) + ' · via ' + (entry.source === 'picker' ? 'picker' : 'clipboard import');
    meta.appendChild(name);
    meta.appendChild(sub);

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = 'Remove from vault';
    del.setAttribute('aria-label', 'Remove ' + entry.glyph + ' from vault');
    del.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      vault = vault.filter((e) => e.glyph !== entry.glyph || e.ts !== entry.ts);
      await saveVault();
      renderVault();
    });

    row.appendChild(glyph);
    row.appendChild(meta);
    row.appendChild(del);
    row.addEventListener('click', async () => {
      const ok = await copyText(entry.glyph);
      // Re-copy bumps the entry to the top (most-recent-first).
      if (ok) await logEmoji(entry.glyph, entry.name, 'vault recopy');
      setStatus(ok ? 'Copied ' + entry.glyph + '.' : 'Copy failed.', !ok);
    });
    frag.appendChild(row);
  });
  vaultEl.appendChild(frag);
}

/* ---------- Import from clipboard (explicit user gesture only) ---------- */
importBtn.addEventListener('click', async () => {
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch (e) {
    setStatus('Clipboard read denied — focus the popup and allow access.', true);
    return;
  }
  // Extract emoji-ish graphemes from the text.
  const found = [];
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    for (const { segment } of seg.segment(text)) {
      if (/\p{Extended_Pictographic}/u.test(segment) && !found.includes(segment)) found.push(segment);
    }
  } catch (e) {
    // Fallback: naive surrogate-pair scan.
    for (const ch of text) {
      if (/\p{Extended_Pictographic}/u.test(ch) && !found.includes(ch)) found.push(ch);
    }
  }
  if (!found.length) {
    setStatus('No emoji found in clipboard text.', true);
    return;
  }
  // Log each found emoji (most recent last → unshift in reverse to keep order).
  for (let i = found.length - 1; i >= 0; i--) {
    const g = found[i];
    const known = EMOJI.find(([eg]) => eg === g);
    vault = vault.filter((e) => e.glyph !== g);
    vault.unshift({ glyph: g, name: known ? known[1] : 'emoji', source: 'clipboard', ts: Date.now() });
  }
  if (vault.length > MAX_ENTRIES) vault.length = MAX_ENTRIES;
  await saveVault();
  renderVault();
  setStatus('Imported ' + found.length + ' emoji from clipboard: ' + found.join(' '));
});

clearBtn.addEventListener('click', async () => {
  if (!vault.length) return;
  vault = [];
  await saveVault();
  renderVault();
  setStatus('Vault cleared.');
});

search.addEventListener('input', renderGrid);
vaultSearch.addEventListener('input', renderVault);

/* ---------- Init ---------- */
(async function init() {
  renderTabs();
  renderGrid();
  await loadVault();
  renderVault();
})();
