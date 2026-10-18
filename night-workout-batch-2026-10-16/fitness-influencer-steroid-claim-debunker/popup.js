/* Claim Journal — personal log of influencer claims. Your notes only.
   No AI, no fact-checking, no medical advice. All data in chrome.storage.local. */
'use strict';

/* ---------- Pure engine (testable, no DOM/chrome) ---------- */
// ENGINE-START
const TAG_LABELS = { unchecked: 'Unchecked', doubtful: 'Doubtful', verified: 'Verified by me' };

/** Build a claim record from raw inputs. Returns {ok, claim} or {ok:false, error}. */
function makeClaim(claim, who, source, notes, tag) {
  claim = (claim || '').trim();
  who = (who || '').trim();
  source = (source || '').trim();
  notes = (notes || '').trim();
  if (!claim) return { ok: false, error: 'Claim text is required.' };
  const validTags = ['unchecked', 'doubtful', 'verified'];
  return {
    ok: true,
    claim: {
      id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      claim, who, source, notes,
      tag: validTags.includes(tag) ? tag : 'unchecked',
      createdAt: new Date().toISOString()
    }
  };
}

/** Filter + search a claim list. q: free text, tag: 'all' | tag value. */
function filterClaims(list, q, tag) {
  q = (q || '').trim().toLowerCase();
  return list.filter(c => {
    if (tag && tag !== 'all' && c.tag !== tag) return false;
    if (!q) return true;
    const hay = [c.claim, c.who, c.source, c.notes].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

/** Human date from ISO string. */
function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
// ENGINE-END

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const els = {
  claim: $('claimText'), who: $('who'), source: $('source'), notes: $('notes'), tag: $('tag'),
  add: $('addBtn'), search: $('search'), filter: $('filter'),
  list: $('list'), empty: $('empty'), count: $('count')
};
let claims = [];

/** Escape HTML for safe rendering of user text. */
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function load() {
  const { claims: saved = [] } = await chrome.storage.local.get('claims');
  claims = Array.isArray(saved) ? saved : [];
  render();
}

async function save() {
  await chrome.storage.local.set({ claims });
}

function render() {
  const items = filterClaims(claims, els.search.value, els.filter.value);
  els.list.innerHTML = '';
  items.forEach(c => {
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML =
      `<div class="claim">${esc(c.claim)}</div>
       <div class="meta">
         <span class="tagchip tag-${c.tag}">${TAG_LABELS[c.tag] || c.tag}</span>
         ${c.who ? `<span>🗣 ${esc(c.who)}</span>` : ''}
         <span>📅 ${fmtDate(c.createdAt)}</span>
       </div>
       ${c.source ? `<div class="meta">🔗 <span style="word-break:break-all">${esc(c.source)}</span></div>` : ''}
       ${c.notes ? `<div class="notes">${esc(c.notes)}</div>` : ''}
       <div class="ops"><button class="del" data-id="${c.id}">Delete</button></div>`;
    els.list.appendChild(li);
  });
  els.list.querySelectorAll('.del').forEach(btn =>
    btn.addEventListener('click', async () => {
      claims = claims.filter(c => c.id !== btn.dataset.id);
      await save();
      render();
    }));
  els.empty.style.display = items.length ? 'none' : 'block';
  els.count.textContent = `${claims.length} claim${claims.length === 1 ? '' : 's'}`;
}

els.add.addEventListener('click', async () => {
  const res = makeClaim(els.claim.value, els.who.value, els.source.value, els.notes.value, els.tag.value);
  if (!res.ok) {
    els.claim.focus();
    return;
  }
  claims.unshift(res.claim);
  await save();
  els.claim.value = ''; els.who.value = ''; els.source.value = ''; els.notes.value = '';
  els.tag.value = 'unchecked';
  render();
});

els.search.addEventListener('input', render);
els.filter.addEventListener('change', render);

load();
