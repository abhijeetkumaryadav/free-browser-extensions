/* Fake Job Scam Recruiter Flag — popup logic
 * On-demand scan: injects content.js into the active tab on click only,
 * then scores local heuristic scam signals. Heuristic aid only — never a verdict.
 * 100% local; no network requests; only the latest score summary persists. */
'use strict';

/* ---------- Lucide-style stroke icons (inline SVG, no remote assets) ---------- */
const ICONS = {
  logo: '<svg viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  scan: '<svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3.5"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>'
};

/* ---------- Heuristic signal definitions ---------- */
const FREE_MAIL = ['gmail.com', 'yahoo.com', 'yahoo.in', 'hotmail.com', 'outlook.com', 'protonmail.com', 'proton.me', 'aol.com', 'rediffmail.com', 'zoho.com'];

const SIGNALS = [
  {
    id: 'upfront-fee', sev: 'high', points: 30,
    test: (d) => /\b(registration fee|application fee|training fee|refundable deposit|security deposit|pay\s+\w{0,15}\s?(before|prior|in advance)|job (kit|guarantee|confirmation) (fee|charge)|visa (fee|processing (fee|charge))|pay.*(upi|upi id|bank transfer).*before)\b/i.test(d.text),
    title: 'Upfront fee request',
    body: 'The posting mentions paying a fee (registration, training, deposit, visa) before starting. Legitimate employers do not ask candidates to pay for a job — this is the strongest scam signal.'
  },
  {
    id: 'freemail', sev: 'high', points: 22,
    test: (d) => d.emails.some(e => FREE_MAIL.includes(e.split('@')[1])),
    title: 'Recruiter on a free email service',
    body: 'Found recruiter email(s) on free providers: {emails}. Real companies normally write from their own corporate domain. Check whether the domain matches the hiring company.'
  },
  {
    id: 'im-only', sev: 'medium', points: 16,
    test: (d) => d.imMentions && d.emails.length === 0,
    title: 'Contact only via WhatsApp/Telegram',
    body: 'Recruitment contact happens only over WhatsApp or Telegram, with no email listed. Legitimate recruiters usually have a traceable corporate channel.'
  },
  {
    id: 'too-good-pay', sev: 'medium', points: 15,
    test: (d) => {
      // Flag pay figures paired with no-experience-required phrasing.
      const easy = /\b(no experience|freshers? welcome|no skills? required|work from home|earn .* (daily|per day)|part[- ]?time)\b/i.test(d.text);
      if (!easy || d.salaryStrings.length === 0) return false;
      return d.salaryStrings.some(s => /[\d,]{5,}/.test(s.replace(/[^\d,]/g, '')));
    },
    title: 'High pay for no experience',
    body: 'Generous pay figures ({salaries}) are paired with "no experience needed" or "work from home" phrasing. Classic bait: real roles paying well usually list real requirements.'
  },
  {
    id: 'urgency', sev: 'medium', points: 12,
    test: (d) => /\b(immediate joining|apply (now|immediately)|limited (slots|vacancies|seats)|act fast|urgent (hiring|requirement)|last date (to apply|is today)|offer (ends|expires) (today|tomorrow))\b/i.test(d.text),
    title: 'Urgency pressure tactics',
    body: 'The posting pushes "immediate joining", "limited slots" or "apply now" urgency. Pressure to decide fast stops you from verifying the employer.'
  },
  {
    id: 'vague-duties', sev: 'low', points: 8,
    test: (d) => d.text.length < 600 && /\b(data entry|form filling|copy paste|ad posting|review (products?|apps?)|like and share)\b/i.test(d.text),
    title: 'Vague low-skill role, thin description',
    body: 'The description is very short and the role (data entry, form filling, ad posting) is vague. Scam listings often keep duties fuzzy while promising easy money.'
  },
  {
    id: 'personal-docs', sev: 'medium', points: 14,
    test: (d) => /\b(send|share|upload).{0,40}(aadhaar|pan card|passport|bank (account|details)|otp)\b/i.test(d.text),
    title: 'Asks for identity documents / OTP early',
    body: 'The posting asks for ID documents, bank details, or an OTP during application. Never share OTPs or full identity documents with an unverified recruiter.'
  },
  {
    id: 'advance-task-pay', sev: 'high', points: 24,
    test: (d) => /\b(pay for (tasks?|assignments?|orders?)|recharge|top[- ]?up|complete (tasks?|orders?).*(unlock|withdraw)|withdrawal (fee|tax))\b/i.test(d.text),
    title: 'Task-based pay with advance payment',
    body: 'Mentions paying to unlock tasks or a withdrawal fee. Task-scam apps work exactly like this: small early payouts, then a fee, then silence.'
  }
];

/* ---------- Scoring ---------- */
function scorePage(data) {
  const findings = [];
  let score = 0;
  for (const sig of SIGNALS) {
    let hit = false, body = sig.body;
    try { hit = !!sig.test(data); } catch (e) { hit = false; }
    if (hit) {
      score += sig.points;
      if (sig.id === 'freemail') {
        body = body.replace('{emails}', data.emails.slice(0, 3).join(', '));
      }
      if (sig.id === 'too-good-pay') {
        body = body.replace('{salaries}', data.salaryStrings.slice(0, 3).join(', '));
      }
      findings.push({ sev: sig.sev, title: sig.title, body, points: sig.points });
    }
  }
  score = Math.min(100, score);
  const verdict = score >= 60 ? 'High risk signals'
    : score >= 30 ? 'Moderate risk signals'
    : score > 0 ? 'Low risk signals' : 'No strong signals';
  return { score, verdict, findings };
}

/* ---------- Rendering ---------- */
function renderIcons() {
  document.getElementById('logo-icon').innerHTML = ICONS.logo;
  document.querySelectorAll('[data-icon="info"]').forEach(el => { el.innerHTML = ICONS.info; });
  document.querySelectorAll('[data-icon="scan"]').forEach(el => { el.innerHTML = ICONS.scan; });
}

function renderResults(result, host) {
  const results = document.getElementById('results');
  results.classList.remove('hidden');
  document.getElementById('score-num').textContent = result.score;
  const arc = document.getElementById('score-arc');
  arc.style.strokeDashoffset = String(326.7 - (326.7 * result.score) / 100);
  document.getElementById('verdict').textContent = result.verdict;
  document.getElementById('summary').textContent =
    result.findings.length === 0
      ? 'No strong scam signals detected — still verify the employer independently.'
      : result.findings.length + ' signal' + (result.findings.length > 1 ? 's' : '') + ' detected. These are heuristics, not proof.';
  document.getElementById('scan-page').textContent = host ? 'Scanned: ' + host : '';

  const box = document.getElementById('findings');
  box.innerHTML = '';
  if (result.findings.length === 0) {
    const clean = document.createElement('div');
    clean.className = 'clean';
    clean.innerHTML = '<span class="icon">' + ICONS.shield + '</span><p>No strong signals. Genuine postings exist without these patterns too — always double-check.</p>';
    box.appendChild(clean);
    return;
  }
  const order = { high: 0, medium: 1, low: 2 };
  result.findings.sort((a, b) => order[a.sev] - order[b.sev]);
  for (const f of result.findings) {
    const card = document.createElement('div');
    card.className = 'finding sev-' + f.sev;
    const sev = document.createElement('span');
    sev.className = 'finding-sev';
    sev.textContent = f.sev + ' · +' + f.points;
    const title = document.createElement('div');
    title.className = 'finding-title';
    title.textContent = f.title;
    const body = document.createElement('div');
    body.className = 'finding-body';
    body.textContent = f.body;
    card.append(sev, title, body);
    box.appendChild(card);
  }
}

/* ---------- Scan flow ---------- */
async function scan() {
  const btn = document.getElementById('scan-btn');
  const label = document.getElementById('scan-label');
  btn.disabled = true;
  label.textContent = 'Scanning…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab');

    // Inject on click only; content script sends data back via message.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

    const data = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Scan timed out')), 8000);
      const handler = (msg) => {
        if (msg && msg.type === 'JOB_PAGE_DATA') {
          clearTimeout(timer);
          chrome.runtime.onMessage.removeListener(handler);
          resolve(msg.payload);
        }
      };
      chrome.runtime.onMessage.addListener(handler);
    });

    const result = scorePage(data);
    renderResults(result, data.host);
    // Persist only the summary (never page content).
    await chrome.storage.local.set({
      lastScan: { at: Date.now(), host: data.host, score: result.score, verdict: result.verdict }
    });
  } catch (err) {
    document.getElementById('results').classList.remove('hidden');
    const box = document.getElementById('findings');
    box.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'finding sev-medium';
    const t = document.createElement('div');
    t.className = 'finding-title';
    t.textContent = 'Could not scan this page';
    const b = document.createElement('div');
    b.className = 'finding-body';
    b.textContent = 'The page may block script injection (e.g. chrome:// pages or some app stores). Try a regular job-listing page. (' + err.message + ')';
    card.append(t, b);
    box.appendChild(card);
  } finally {
    btn.disabled = false;
    label.textContent = 'Scan this job page';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderIcons();
  document.getElementById('scan-btn').addEventListener('click', scan);
});
