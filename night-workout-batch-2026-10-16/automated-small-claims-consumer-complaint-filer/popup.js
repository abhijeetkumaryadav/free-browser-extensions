// Complaint Helper — guided complaint-letter generator + filing checklist.
// Manual tool: builds documents from the user's own inputs. Templates only,
// NOT legal advice. The user files the complaint themselves.
'use strict';

const $ = (id) => document.getElementById(id);

const CHECKLIST = [
  'Write down the facts: dates, order numbers, amounts, names',
  'Gather evidence: receipts, photos, emails, chat transcripts',
  'Check the company\'s own complaint/grievance process first',
  'Send the demand letter and keep a dated copy',
  'Choose where to file: company portal, consumer helpline, agency, ombudsman, or small-claims court',
  'Attach evidence to your filing (copies, never originals)',
  'Note any reference/complaint number you receive',
  'Track the response deadline you set in your letter',
  'Escalate if the deadline passes with no response',
  'Keep every document until the matter is fully resolved',
];

const FIELDS = ['f-name', 'f-contact', 'f-company', 'f-facts', 'f-amount', 'f-date', 'f-ask', 'f-evidence', 'f-venue', 'f-deadline'];

function val(id) { return ($(id).value || '').trim(); }
function orBlank(v, fallback) { return v || fallback; }

function fmtDate(iso) {
  if (!iso) return '[date]';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d) ? '[date]' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function buildLetter() {
  const name = orBlank(val('f-name'), '[Your full name]');
  const contact = orBlank(val('f-contact'), '[email / phone]');
  const company = orBlank(val('f-company'), '[Company name]');
  const facts = orBlank(val('f-facts'), '[Describe what happened, in your own words: what you bought, when, what went wrong, and what you have tried so far.]');
  const amount = orBlank(val('f-amount'), '[amount]');
  const purchaseDate = fmtDate(val('f-date'));
  const ask = orBlank(val('f-ask'), '[State clearly what you want: refund, replacement, repair, or compensation.]');
  const deadline = fmtDate(val('f-deadline'));
  const evidenceLines = val('f-evidence').split('\n').map((s) => s.trim()).filter(Boolean);
  const evidence = evidenceLines.length
    ? evidenceLines.map((e, i) => `  ${i + 1}. ${e}`).join('\n')
    : '  [List each piece of evidence, one per line.]';

  return (
`From: ${name} (${contact})
To: ${company} — Customer Complaints
Date: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}

Subject: Formal complaint — ${amount} (purchase ${purchaseDate})

Dear Sir/Madam,

I am writing to formally complain about the following matter:

${facts}

Amount involved: ${amount}
Date of purchase/transaction: ${purchaseDate}

What I am asking for: ${ask}

I have attached / can provide the following evidence:
${evidence}

Please respond by ${deadline}. If I do not receive a satisfactory response, I am prepared to escalate this matter to the appropriate consumer-protection authority or small-claims court.

Yours faithfully,
${name}

---
This letter was drafted from your own inputs by Complaint Helper.
It is a template, NOT legal advice. Verify the rules and deadlines
that apply in your jurisdiction before filing.`
  );
}

function renderLetter() {
  $('letterOut').textContent = buildLetter();
}

function renderChecklist(state) {
  const done = state.done || {};
  $('checklistOut').innerHTML = CHECKLIST.map((item, i) =>
    `<label class="check${done[i] ? ' done' : ''}"><input type="checkbox" data-i="${i}"${done[i] ? ' checked' : ''}><span>${esc(item)}</span></label>`
  ).join('');
  $('checklistOut').querySelectorAll('input').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const s = await load();
      s.done = s.done || {};
      s.done[cb.dataset.i] = cb.checked;
      await save(s);
      renderChecklist(s);
    });
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function load() {
  const { complaint } = await chrome.storage.local.get('complaint');
  return complaint || {};
}

async function save(state) {
  await chrome.storage.local.set({ complaint: state });
}

function fillForm(state) {
  for (const id of FIELDS) $(id).value = state[id] || '';
  $('statusSel').value = state.status || 'draft';
}

function readForm() {
  const state = {};
  for (const id of FIELDS) state[id] = val(id);
  return state;
}

// Tabs.
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
    $('tab-' + t.dataset.tab).classList.remove('hidden');
    if (t.dataset.tab === 'letter') renderLetter();
  });
});

$('saveBtn').addEventListener('click', async () => {
  const prev = await load();
  const state = Object.assign({}, prev, readForm());
  await save(state);
  $('saveBtn').textContent = 'Saved ✓';
  setTimeout(() => { $('saveBtn').textContent = 'Save details'; }, 1200);
});

$('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('letterOut').textContent);
    $('copyBtn').textContent = 'Copied ✓';
  } catch (_) {
    $('copyBtn').textContent = 'Copy failed — select manually';
  }
  setTimeout(() => { $('copyBtn').textContent = 'Copy letter'; }, 1500);
});

$('statusSel').addEventListener('change', async () => {
  const s = await load();
  s.status = $('statusSel').value;
  await save(s);
});

$('wipeBtn').addEventListener('click', async () => {
  if (confirm('Delete all saved complaint data?')) {
    await chrome.storage.local.remove('complaint');
    location.reload();
  }
});

// Init.
(async () => {
  const state = await load();
  fillForm(state);
  renderChecklist(state);
})();
