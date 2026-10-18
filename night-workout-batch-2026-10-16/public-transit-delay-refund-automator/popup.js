/* Public Transit Delay Refund Helper — popup logic
 * NARROWED SCOPE: no transit API exists for automated refunds, so this is an
 * honest manual claim helper: delay logbook, claim-letter generator, checklist,
 * and per-delay status tracking. All data in chrome.storage.local. No network. */
'use strict';

/* ---------- Lucide-style stroke icons ---------- */
const ICONS = {
  logo: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 10h16"/><path d="M8 21l1-4"/><path d="M16 21l-1-4"/><circle cx="8.5" cy="13.5" r=".8"/><circle cx="15.5" cy="13.5" r=".8"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>'
};

/* ---------- Checklist steps ---------- */
const CHECKLIST_STEPS = [
  { t: 'Record the delay details', d: 'Log date, route, delay length and ticket/card reference while it is fresh.' },
  { t: 'Keep proof', d: 'Screenshot the app disruption notice, delay boards, or announcements.' },
  { t: 'Check the agency refund policy', d: 'Find the official delay-refund threshold (e.g. 30/60/90 minutes) on their website.' },
  { t: 'Generate the claim letter', d: 'Use the Letter tab to draft a refund request from your logged delay.' },
  { t: 'Submit to the agency', d: 'Send via their grievance portal, email, or counter — keep the complaint number.' },
  { t: 'Follow up', d: 'Track status below; escalate if no response within the agency stated timeline.' }
];

/* ---------- Storage helpers ---------- */
async function load() {
  const data = await chrome.storage.local.get({ delays: [], checklist: {} });
  return data;
}
async function saveDelays(delays) {
  await chrome.storage.local.set({ delays });
}

/* ---------- Delay logbook ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderStats(delays) {
  const total = delays.length;
  const mins = delays.reduce((a, d) => a + d.minutes, 0);
  const claimed = delays.filter(d => d.status !== 'logged').length;
  document.getElementById('stats').innerHTML =
    stat(total, 'delays logged') + stat(mins, 'minutes delayed') + stat(claimed, 'claims tracked');
  function stat(n, label) {
    return '<div class="stat"><b>' + n + '</b><span>' + label + '</span></div>';
  }
}

function statusBadge(status) {
  const labels = { logged: 'logged', sent: 'claim sent', refunded: 'refunded', denied: 'denied' };
  return '<span class="badge ' + status + '">' + labels[status] + '</span>';
}

async function renderDelays() {
  const { delays } = await load();
  renderStats(delays);
  const box = document.getElementById('delay-list');
  box.innerHTML = '';
  if (delays.length === 0) {
    box.innerHTML = '<div class="empty">No delays logged yet. Add your first one above.</div>';
    return;
  }
  delays.forEach((d, i) => {
    const card = document.createElement('div');
    card.className = 'delay-card';
    card.innerHTML =
      '<div class="head"><span class="route">' + escapeHtml(d.agency) + ' · ' + escapeHtml(d.route) + '</span>' + statusBadge(d.status) + '</div>' +
      '<div class="meta">' + escapeHtml(d.date) + ' · ' + d.minutes + ' min delay' +
      (d.from ? ' · ' + escapeHtml(d.from) + (d.to ? ' → ' + escapeHtml(d.to) : '') : '') + '</div>' +
      '<div class="card-actions">' +
        '<button data-act="sent" data-i="' + i + '">Mark sent</button>' +
        '<button data-act="refunded" data-i="' + i + '">Refunded</button>' +
        '<button data-act="denied" data-i="' + i + '">Denied</button>' +
        '<button data-act="del" data-i="' + i + '" class="danger">Delete</button>' +
      '</div>';
    box.appendChild(card);
  });
  box.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { delays } = await load();
      const i = Number(btn.dataset.i);
      const act = btn.dataset.act;
      if (act === 'del') delays.splice(i, 1);
      else delays[i].status = act;
      await saveDelays(delays);
      renderDelays();
      renderLetterSelect();
    });
  });
}

/* ---------- Claim letter ---------- */
function buildLetter(d) {
  const route = d.from && d.to ? d.route + ' (' + d.from + ' to ' + d.to + ')' : d.route;
  return 'Subject: Request for fare refund — service delay on ' + d.date + '\n\n' +
    'Dear ' + d.agency + ' customer care,\n\n' +
    'I am writing to request a fare refund for a service disruption I experienced:\n\n' +
    '  Date of travel: ' + d.date + '\n' +
    '  Route / line: ' + route + '\n' +
    '  Delay experienced: approximately ' + d.minutes + ' minutes\n' +
    (d.ticket ? '  Ticket / card reference: ' + d.ticket + '\n' : '') +
    '\nThe delay caused significant inconvenience, and I believe I qualify for compensation under your delay-refund policy.\n\n' +
    'Please let me know the outcome and the mode of refund (account credit / original payment method).\n\n' +
    'Thank you,\n' + (d.name || '[Your name]') + '\n' +
    '\n---\nDrafted with the Public Transit Delay Refund Helper. This extension does not file claims automatically — please submit this yourself via the agency grievance portal or email.';
}

async function renderLetterSelect() {
  const { delays } = await load();
  const sel = document.getElementById('letter-delay');
  sel.innerHTML = '';
  if (delays.length === 0) {
    sel.innerHTML = '<option value="">Log a delay first</option>';
    document.getElementById('letter-output').value = '';
    return;
  }
  delays.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = d.date + ' · ' + d.agency + ' · ' + d.route + ' (' + d.minutes + ' min)';
    sel.appendChild(opt);
  });
  updateLetter();
}

async function updateLetter() {
  const { delays } = await load();
  const i = Number(document.getElementById('letter-delay').value);
  if (Number.isNaN(i) || !delays[i]) {
    document.getElementById('letter-output').value = '';
    return;
  }
  document.getElementById('letter-output').value = buildLetter(delays[i]);
}

/* ---------- Checklist ---------- */
async function renderChecklist() {
  const { checklist } = await load();
  const box = document.getElementById('checklist');
  box.innerHTML = '';
  CHECKLIST_STEPS.forEach((step, i) => {
    const item = document.createElement('label');
    item.className = 'check-item' + (checklist[i] ? ' done' : '');
    item.innerHTML =
      '<input type="checkbox" ' + (checklist[i] ? 'checked' : '') + '>' +
      '<span class="check-text"><b>' + (i + 1) + '. ' + escapeHtml(step.t) + '</b><span>' + escapeHtml(step.d) + '</span></span>';
    item.querySelector('input').addEventListener('change', async (e) => {
      const data = await load();
      data.checklist[i] = e.target.checked;
      await chrome.storage.local.set({ checklist: data.checklist });
      renderChecklist();
    });
    box.appendChild(item);
  });
}

/* ---------- Tabs & init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logo-icon').innerHTML = ICONS.logo;
  document.querySelectorAll('[data-icon="info"]').forEach(el => { el.innerHTML = ICONS.info; });
  document.querySelectorAll('[data-icon="plus"]').forEach(el => { el.innerHTML = ICONS.plus; });
  document.querySelectorAll('[data-icon="copy"]').forEach(el => { el.innerHTML = ICONS.copy; });
  document.querySelectorAll('[data-icon="mail"]').forEach(el => { el.innerHTML = ICONS.mail; });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tabpane').forEach(p => p.classList.add('hidden'));
      document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
    });
  });

  document.getElementById('f-date').valueAsDate = new Date();

  document.getElementById('delay-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { delays } = await load();
    delays.unshift({
      id: Date.now(),
      date: document.getElementById('f-date').value,
      agency: document.getElementById('f-agency').value.trim(),
      route: document.getElementById('f-route').value.trim(),
      minutes: Number(document.getElementById('f-minutes').value),
      from: document.getElementById('f-from').value.trim(),
      to: document.getElementById('f-to').value.trim(),
      ticket: document.getElementById('f-ticket').value.trim(),
      name: document.getElementById('f-name').value.trim(),
      status: 'logged'
    });
    await saveDelays(delays);
    e.target.reset();
    document.getElementById('f-date').valueAsDate = new Date();
    renderDelays();
    renderLetterSelect();
  });

  document.getElementById('letter-delay').addEventListener('change', updateLetter);

  document.getElementById('copy-letter').addEventListener('click', async () => {
    const ta = document.getElementById('letter-output');
    ta.select();
    try {
      await navigator.clipboard.writeText(ta.value);
      document.getElementById('copy-letter').textContent = 'Copied!';
      setTimeout(() => { document.getElementById('copy-letter').innerHTML = '<span class="icon">' + ICONS.copy + '</span>Copy letter'; }, 1500);
    } catch (err) { /* clipboard may be unavailable; selection remains */ }
  });

  document.getElementById('mailto-btn').addEventListener('click', async () => {
    const { delays } = await load();
    const i = Number(document.getElementById('letter-delay').value);
    const to = document.getElementById('letter-to').value.trim();
    const letter = document.getElementById('letter-output').value;
    const subject = delays[i] ? 'Refund request — ' + delays[i].agency + ' delay ' + delays[i].date : 'Transit delay refund request';
    chrome.tabs.create({
      url: 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(letter)
    });
  });

  document.getElementById('reset-checklist').addEventListener('click', async () => {
    await chrome.storage.local.set({ checklist: {} });
    renderChecklist();
  });

  renderDelays();
  renderLetterSelect();
  renderChecklist();
});
