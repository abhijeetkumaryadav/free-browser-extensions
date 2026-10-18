/* Tone Shift — tone toolkit. No AI: suggestions are bundled templates the user applies manually. */
'use strict';

/* ---------- Bundled tone data ---------- */

// Phrase-swap templates per tone. Each entry: {match (regex-ish lowercase), from, to}
const SWAPS = {
  formal: [
    { from: 'hi', to: 'Dear' },
    { from: 'hey', to: 'Hello' },
    { from: 'thanks', to: 'Thank you' },
    { from: 'gonna', to: 'going to' },
    { from: 'wanna', to: 'would like to' },
    { from: 'asap', to: 'at your earliest convenience' },
    { from: 'sorry about that', to: 'I apologize for the inconvenience' },
    { from: 'just checking in', to: 'I am writing to follow up' },
    { from: 'no problem', to: 'You are most welcome' },
    { from: 'let me know', to: 'Please do not hesitate to contact me' }
  ],
  friendly: [
    { from: 'dear sir or madam', to: 'Hello' },
    { from: 'i am writing to inform you', to: 'Quick heads-up' },
    { from: 'pursuant to', to: 'following up on' },
    { from: 'at your earliest convenience', to: 'whenever you get a chance' },
    { from: 'please be advised', to: 'just so you know' },
    { from: 'do not hesitate to contact me', to: 'happy to chat anytime' },
    { from: 'yours sincerely', to: 'best regards' }
  ],
  firm: [
    { from: 'sorry to bother you', to: 'I need to raise this directly' },
    { from: 'whenever you get a chance', to: 'by end of day' },
    { from: 'if possible', to: 'this is required' },
    { from: 'maybe we could', to: 'we need to' },
    { from: 'just wanted to ask', to: 'I am requesting' },
    { from: 'no worries at all', to: 'this needs to be resolved' }
  ],
  apologetic: [
    { from: 'my bad', to: 'I take full responsibility' },
    { from: 'oops', to: 'I sincerely apologize' },
    { from: 'whatever', to: 'I understand your frustration' },
    { from: 'not my fault', to: 'I understand how this happened on our side' },
    { from: 'calm down', to: 'I hear you, and I want to make this right' },
    { from: 'as i said before', to: 'to clarify' }
  ]
};

// Tone checklists: things to verify before sending.
const CHECKLISTS = {
  formal: [
    'Greeting uses a title or full name (Dear Ms. Rao, Dear Team)',
    'No contractions (use "do not" instead of "don\'t")',
    'Clear subject line that states the purpose',
    'Professional sign-off (Kind regards, Sincerely)',
    'Full name and contact details in signature'
  ],
  friendly: [
    'Warm greeting by first name',
    'One friendly opening line before the request',
    'Softeners present ("just", "quick", "when you can")',
    'Casual sign-off (Best, Cheers, Thanks!)',
    'Reads like a human, not a template'
  ],
  firm: [
    'Request stated in the first two sentences',
    'Concrete deadline included',
    'No apologizing for making the request',
    'Next steps spelled out explicitly',
    'Tone is direct but never rude'
  ],
  apologetic: [
    'Apology comes before any explanation',
    'No deflecting ("but", "however" after sorry)',
    'Names the specific thing that went wrong',
    'States what you will do to fix it',
    'Invites the reader to reply with concerns'
  ]
};

let currentTone = 'formal';

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
    if (btn.dataset.tab === 'saved') renderSaved();
  });
});

/* ---------- Tone picker ---------- */
document.querySelectorAll('.tone').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tone').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTone = btn.dataset.tone;
  });
});

/* ---------- Analysis ---------- */
// Find which bundled swap phrases appear in the draft text.
function findSwaps(text) {
  const lower = text.toLowerCase();
  return (SWAPS[currentTone] || []).filter(s => lower.includes(s.from));
}

// Insert a suggested phrase at the cursor position of the draft.
function insertAtCursor(phrase) {
  const ta = document.getElementById('draft');
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0, start) + phrase + ta.value.slice(end);
  ta.focus();
}

document.getElementById('analyze').addEventListener('click', () => {
  const text = document.getElementById('draft').value.trim();
  const results = document.getElementById('results');
  const swapsEl = document.getElementById('swaps');
  const checkEl = document.getElementById('checklist');
  swapsEl.innerHTML = '';
  checkEl.innerHTML = '';

  if (!text) {
    swapsEl.innerHTML = '<li class="swap"><span class="from">Write a draft first — then I will scan it for tone tweaks.</span></li>';
  } else {
    const hits = findSwaps(text);
    if (!hits.length) {
      swapsEl.innerHTML = '<li class="swap"><span class="from">No bundled swaps found — your draft already reads ' + currentTone + '.</span></li>';
    } else {
      for (const s of hits) {
        const li = document.createElement('li');
        li.className = 'swap';
        li.innerHTML = '<span class="from">' + escapeHtml(s.from) + '</span><span class="to">' + escapeHtml(s.to) + '</span>';
        li.title = 'Click to insert the suggestion at your cursor';
        li.addEventListener('click', () => insertAtCursor(s.to));
        swapsEl.appendChild(li);
      }
    }
  }

  for (const item of CHECKLISTS[currentTone]) {
    const li = document.createElement('li');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    li.appendChild(cb);
    li.appendChild(document.createTextNode(item));
    checkEl.appendChild(li);
  }
  results.classList.remove('hidden');
});

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Saved drafts ---------- */
async function getDrafts() {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  return drafts;
}

document.getElementById('saveDraft').addEventListener('click', async () => {
  const text = document.getElementById('draft').value.trim();
  if (!text) return;
  const drafts = await getDrafts();
  drafts.unshift({
    id: Date.now(),
    title: document.getElementById('draftTitle').value.trim() || text.slice(0, 40),
    tone: currentTone,
    text,
    savedAt: new Date().toISOString()
  });
  await chrome.storage.local.set({ drafts });
  document.getElementById('draftTitle').value = '';
  document.getElementById('draft').value = '';
});

async function renderSaved() {
  const drafts = await getDrafts();
  const list = document.getElementById('savedList');
  const empty = document.getElementById('savedEmpty');
  list.innerHTML = '';
  empty.style.display = drafts.length ? 'none' : 'block';
  for (const d of drafts) {
    const li = document.createElement('li');
    li.innerHTML =
      '<div class="title">' + escapeHtml(d.title) + '</div>' +
      '<div class="meta">' + escapeHtml(d.tone) + ' · ' + new Date(d.savedAt).toLocaleString() + '</div>' +
      '<div class="acts"><button class="ghost load">Load</button><button class="ghost del">Delete</button></div>';
    li.querySelector('.load').addEventListener('click', () => {
      document.getElementById('draft').value = d.text;
      document.querySelector('.tab[data-tab="draft"]').click();
    });
    li.querySelector('.del').addEventListener('click', async () => {
      await chrome.storage.local.set({ drafts: (await getDrafts()).filter(x => x.id !== d.id) });
      renderSaved();
    });
    list.appendChild(li);
  }
}
