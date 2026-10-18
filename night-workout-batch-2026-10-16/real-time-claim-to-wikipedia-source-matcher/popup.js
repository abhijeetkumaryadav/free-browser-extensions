// ============================================================================
// Claim Check — popup logic
// No AI, no automation: the extension only opens a Wikipedia search tab and
// stores the verdicts YOU enter locally in chrome.storage.local.
// ============================================================================

// ENGINE-START
// --- Pure, headless-testable engine ----------------------------------------

/** Build the Wikipedia search URL for a claim string. */
function wikiSearchUrl(claim) {
  return 'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(claim.trim());
}

/** Validate a verdict chip value. */
function validVerdict(v) {
  return ['confirmed', 'unconfirmed', 'disputed', 'false'].includes(v);
}

/** Create a log entry. Returns null when the claim is empty or verdict invalid. */
function makeEntry(claim, verdict, notes) {
  const c = (claim || '').trim();
  if (!c || !validVerdict(verdict)) return null;
  return {
    id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    claim: c.slice(0, 500),
    verdict,
    notes: (notes || '').trim().slice(0, 500),
    at: Date.now()
  };
}

/** Newest-first, immutable sort of log entries. */
function sortEntries(entries) {
  return [...entries].sort((a, b) => b.at - a.at);
}

/** Format a timestamp for display. */
function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
// ENGINE-END

// --- UI wiring -------------------------------------------------------------

const $ = (id) => document.getElementById(id);
let activeVerdict = 'unconfirmed';

function loadEntries(cb) {
  chrome.storage.local.get(['claims'], (res) => cb(Array.isArray(res.claims) ? res.claims : []));
}
function saveEntries(entries, cb) {
  chrome.storage.local.set({ claims: entries }, () => cb && cb());
}

function render() {
  loadEntries((entries) => {
    const list = $('list');
    const items = sortEntries(entries);
    $('count').textContent = items.length ? '(' + items.length + ')' : '';
    $('clear').classList.toggle('hidden', items.length === 0);
    if (!items.length) {
      list.innerHTML = '<div class="empty">No verdicts yet. Check a claim above.</div>';
      return;
    }
    list.innerHTML = '';
    for (const e of items) {
      const div = document.createElement('div');
      div.className = 'item';
      const del = document.createElement('button');
      del.className = 'del';
      del.title = 'Delete';
      del.textContent = '×';
      del.addEventListener('click', () => {
        saveEntries(entries.filter((x) => x.id !== e.id), render);
      });
      const body = document.createElement('div');
      const c = document.createElement('div');
      c.className = 'c';
      c.textContent = e.claim;
      const v = document.createElement('span');
      v.className = 'v ' + e.verdict;
      v.textContent = e.verdict.charAt(0).toUpperCase() + e.verdict.slice(1);
      body.appendChild(c);
      body.appendChild(v);
      if (e.notes) {
        const n = document.createElement('div');
        n.className = 'n';
        n.textContent = e.notes;
        body.appendChild(n);
      }
      const t = document.createElement('div');
      t.className = 't';
      t.textContent = fmtWhen(e.at);
      body.appendChild(t);
      div.appendChild(del);
      div.appendChild(body);
      list.appendChild(div);
    }
  });
}

document.querySelectorAll('#verdictRow .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#verdictRow .chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    activeVerdict = chip.dataset.v;
  });
});
document.querySelector('#verdictRow .chip[data-v="unconfirmed"]').classList.add('active');

$('search').addEventListener('click', () => {
  const claim = $('claim').value.trim();
  if (!claim) {
    $('claim').focus();
    return;
  }
  chrome.tabs.create({ url: wikiSearchUrl(claim) });
});

$('save').addEventListener('click', () => {
  const entry = makeEntry($('claim').value, activeVerdict, $('notes').value);
  if (!entry) {
    $('claim').focus();
    return;
  }
  loadEntries((entries) => {
    entries.push(entry);
    saveEntries(entries, () => {
      $('notes').value = '';
      render();
    });
  });
});

$('clear').addEventListener('click', () => {
  if (confirm('Delete all logged verdicts?')) saveEntries([], render);
});

render();
