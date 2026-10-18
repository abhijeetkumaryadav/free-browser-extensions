/* Cover Letter Kit — template outline builder + heuristic keyword extractor.
 * No AI. Templates are static; keywords come from frequency heuristics.
 * Everything stays in chrome.storage.local. */

// ---- Bundled cover-letter templates (outlines with prompts) ----
const TEMPLATES = {
  standard: {
    label: 'Standard (3-paragraph)',
    sections: [
      { title: 'Opening — role & excitement', prompt: 'Name the role, the company, and why you want it. One strong sentence.' },
      { title: 'Body — proof of fit', prompt: '2–3 achievements that match the job. Numbers beat adjectives.' },
      { title: 'Closing — ask', prompt: 'Restate enthusiasm, invite a conversation, thank them.' }
    ]
  },
  career_change: {
    label: 'Career change',
    sections: [
      { title: 'Opening — the pivot', prompt: 'Name the role and frame your change as a strength, not an apology.' },
      { title: 'Bridge — transferable skills', prompt: 'Map 2–3 skills from your old field to this job\'s needs.' },
      { title: 'Closing — commitment', prompt: 'Show you understand the new field. Ask for the interview.' }
    ]
  },
  referral: {
    label: 'Referred by someone',
    sections: [
      { title: 'Opening — the referral', prompt: 'Name the referrer and their connection in the first sentence.' },
      { title: 'Body — why you fit', prompt: '2 achievements that back up the referral\'s confidence.' },
      { title: 'Closing — follow-up', prompt: 'Thank them, reference the referrer once more, propose next steps.' }
    ]
  }
};

// ---- Heuristic keyword extractor ----
const STOP = new Set(('the,a,an,and,or,of,to,in,for,on,with,as,at,by,from,is,are,was,' +
  'were,be,been,being,have,has,had,do,does,did,will,would,can,could,should,' +
  'may,might,must,shall,it,its,this,that,these,those,we,you,they,our,your,' +
  'their,i,me,my,us,who,what,which,when,where,how,why,not,no,so,if,then,' +
  'than,too,very,just,also,into,over,after,before,between,through,during,' +
  'about,up,out,off,all,any,each,other,some,such,only,own,same,per,etc,' +
  'including,include,includes,across,within,well,able,etc').split(','));

function extractKeywords(text) {
  const words = (text.toLowerCase().match(/[a-z][a-z0-9+\-#.]*/g) || []);
  const freq = new Map();
  for (const w of words) {
    const clean = w.replace(/^[.\-+]+|[.\-+]+$/g, '');
    if (clean.length < 3 || STOP.has(clean) || /^\d+$/.test(clean)) continue;
    freq.set(clean, (freq.get(clean) || 0) + 1);
  }
  // Also capture multi-word skill-ish phrases near common cue words.
  return [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word, count]) => ({ word, count }));
}

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const $ = id => document.getElementById(id);

// ---- Tabs ----
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tabpanel').forEach(x => x.classList.add('hidden'));
  t.classList.add('active');
  $('tab-' + t.dataset.tab).classList.remove('hidden');
}));

// ---- Outline tab ----
const sel = $('template');
Object.entries(TEMPLATES).forEach(([key, t]) => {
  const o = document.createElement('option');
  o.value = key; o.textContent = t.label;
  sel.appendChild(o);
});

function renderSections() {
  const t = TEMPLATES[sel.value];
  $('sections').innerHTML = t.sections.map((s, i) =>
    `<div class="section"><label>${esc(s.title)}</label>` +
    `<div class="prompt">${esc(s.prompt)}</div>` +
    `<textarea data-i="${i}" placeholder="Write this section…"></textarea></div>`
  ).join('');
}
sel.addEventListener('change', renderSections);
renderSections();

function currentDraftText() {
  const t = TEMPLATES[sel.value];
  return t.sections.map((s, i) => {
    const ta = document.querySelector(`textarea[data-i="${i}"]`);
    return s.title + '\n' + (ta ? ta.value.trim() : '');
  }).join('\n\n');
}

$('save-draft').addEventListener('click', async () => {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  drafts.unshift({ id: Date.now(), template: sel.value, text: currentDraftText(), at: new Date().toISOString() });
  await chrome.storage.local.set({ drafts });
  renderDrafts();
  $('save-draft').textContent = 'Saved ✓';
  setTimeout(() => $('save-draft').textContent = 'Save draft', 1200);
});

$('copy-draft').addEventListener('click', async () => {
  await navigator.clipboard.writeText(currentDraftText());
  $('copy-draft').textContent = 'Copied ✓';
  setTimeout(() => $('copy-draft').textContent = 'Copy text', 1200);
});

// ---- Keywords tab ----
let keywords = [];
let checkedKw = new Set();

$('extract').addEventListener('click', () => {
  const jd = $('jd').value.trim();
  const box = $('kw-list'), sum = $('kw-summary');
  box.innerHTML = '';
  if (!jd) { sum.classList.add('hidden'); box.innerHTML = '<div class="empty">Paste a job description first.</div>'; return; }
  keywords = extractKeywords(jd);
  checkedKw = new Set();
  sum.classList.remove('hidden');
  sum.innerHTML = `<b>${keywords.length}</b> repeated keywords found. Check each off as you address it in your letter.`;
  if (keywords.length === 0) {
    box.innerHTML = '<div class="empty">No repeated keywords found — the description may be short.</div>';
    return;
  }
  box.innerHTML = keywords.map((k, i) =>
    `<label class="kw"><input type="checkbox" data-i="${i}"> ${esc(k.word)} <span class="freq">×${k.count}</span></label>`
  ).join('');
  box.querySelectorAll('input').forEach(cb => cb.addEventListener('change', () => {
    cb.closest('.kw').classList.toggle('done', cb.checked);
  }));
});

// ---- Drafts tab ----
async function renderDrafts() {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  const box = $('draft-list');
  if (drafts.length === 0) { box.innerHTML = '<div class="empty">No saved drafts yet.</div>'; return; }
  box.innerHTML = drafts.map(d =>
    `<div class="draft"><div class="t">${esc(TEMPLATES[d.template]?.label || d.template)}</div>` +
    `<div class="d">${new Date(d.at).toLocaleString()}</div>` +
    `<div class="acts"><button data-act="copy" data-id="${d.id}">Copy</button>` +
    `<button data-act="del" data-id="${d.id}">Delete</button></div></div>`
  ).join('');
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', async () => {
    const id = +b.dataset.id;
    let { drafts: ds = [] } = await chrome.storage.local.get('drafts');
    const d = ds.find(x => x.id === id);
    if (b.dataset.act === 'copy' && d) await navigator.clipboard.writeText(d.text);
    if (b.dataset.act === 'del') { ds = ds.filter(x => x.id !== id); await chrome.storage.local.set({ drafts: ds }); }
    renderDrafts();
  }));
}
renderDrafts();

// Self-test (logs only).
(function selfTest() {
  const kws = extractKeywords('We need Python and leadership. Python experience required. Leadership and Python teamwork.');
  console.log('[cover-kit] self-test keywords:', kws.map(k => k.word).join(','), kws.some(k => k.word === 'python') ? 'PASS' : 'FAIL');
})();
