'use strict';
/* Prop Swap — searchable bundled reference of yoga props -> household substitutes.
   Pure reference data; no coaching, fully local. */

// ENGINE-START
const PROPS = [
  { prop: 'Yoga strap / belt', sub: 'Bathrobe belt, tie, or scarf',
    note: 'Use for binding poses and hamstring stretches. Pick a non-stretchy belt so the loop length stays fixed.',
    alt: 'Old necktie, luggage strap' },
  { prop: 'Yoga block', sub: 'Stack of hardcover books or a sturdy box',
    note: 'Use under hands, hips, or head for support. Books must be hardcover and taped into a solid stack so they don\'t slide.',
    alt: 'Thick dictionary, shoe box filled with towels' },
  { prop: 'Bolster', sub: 'Firm couch cushion or rolled sleeping bag',
    note: 'Use for restorative poses and chest openers. Choose something firm — a soft pillow collapses and gives no support.',
    alt: 'Rolled bath towels inside a pillowcase' },
  { prop: 'Blanket', sub: 'Bath towel or folded throw',
    note: 'Use for knee padding, shoulder-stand support, or warmth in savasana. Fold to the thickness you need.',
    alt: 'Beach towel, fleece throw' },
  { prop: 'Meditation cushion (zafu)', sub: 'Firm bed pillow or folded duvet',
    note: 'Use to elevate hips in seated poses. Stack until hips sit slightly above the knees.',
    alt: 'Couch cushion, folded yoga mat' },
  { prop: 'Yoga wheel', sub: 'Rolled bath mat or a large sturdy ball',
    note: 'Use for gentle backbends only — test that the substitute doesn\'t roll away under you.',
    alt: 'Foam roller (safer substitute)' },
  { prop: 'Eye pillow', sub: 'Folded washcloth or small sock filled with rice',
    note: 'Use in savasana for darkness. Keep it light — rice-filled socks can get heavy; don\'t press on the eyes.',
    alt: 'Folded bandana' },
  { prop: 'Sandbag', sub: 'Bag of rice or a heavy book in a tote',
    note: 'Use for grounding in restorative poses. Never place heavy weight on joints or the neck.',
    alt: 'Bag of flour (double-bagged)' },
  { prop: 'Non-slip mat', sub: 'Carpet, rug, or towel on a hard floor',
    note: 'Prevents slipping. A towel on tile still slides — layer a rug underneath for grip.',
    alt: 'Bath mat with rubber backing' },
  { prop: 'Yoga wedge', sub: 'Doorstop or folded thick book',
    note: 'Use under wrists or heels. Keep the angle gentle — a steep wedge strains wrists.',
    alt: 'Slanted cushion' },
  { prop: 'Yoga trapeze / swing', sub: 'No safe household substitute',
    note: 'Do not hang from door frames or bunk beds — they are not rated for body weight. Skip inversion practice without proper equipment.',
    alt: 'None — do not improvise' },
  { prop: 'Cork massage ball', sub: 'Tennis ball or lacrosse ball',
    note: 'Use for foot and glute release against the floor. Start gently — hard balls on bone hurt.',
    alt: 'Baseball (firmer), dryer ball' },
];

function searchProps(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return PROPS.slice();
  return PROPS.filter(p =>
    p.prop.toLowerCase().includes(q) ||
    p.sub.toLowerCase().includes(q) ||
    p.alt.toLowerCase().includes(q)
  );
}
// ENGINE-END

/* ---------- UI ---------- */
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const qEl = document.getElementById('q');

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render(query) {
  const items = searchProps(query);
  listEl.innerHTML = '';
  emptyEl.classList.toggle('hidden', items.length > 0);
  for (const p of items) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML =
      '<h2>' + esc(p.prop) + '</h2>' +
      '<div class="sub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4L8 20l-5 1 1-5z"/></svg><strong>' + esc(p.sub) + '</strong></div>' +
      '<p class="note">' + esc(p.note) + '</p>' +
      '<p class="alt">Also works: <span>' + esc(p.alt) + '</span></p>';
    listEl.appendChild(card);
  }
}

qEl.addEventListener('input', () => {
  const q = qEl.value;
  render(q);
  chrome.storage.local.set({ lastQuery: q }).catch(() => {});
});

chrome.storage.local.get({ lastQuery: '' }).then(({ lastQuery }) => {
  qEl.value = lastQuery || '';
  render(lastQuery || '');
}).catch(() => render(''));
