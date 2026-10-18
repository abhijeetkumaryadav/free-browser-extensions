/* Growth Loop Scanner — popup controller.
   On explicit "Scan this page" click, a read-only collector runs on the
   active tab and bundled heuristic CHECKS are scored as HIT / PARTIAL / MISS.
   Heuristic pattern matching only — never growth advice. 100% local. */
'use strict';

const $ = (id) => document.getElementById(id);

/* Bundled heuristic checks: id, title, how many distinct signals count as a
   hit, partial at half, plus per-check evidence extraction is page-side. */
const CHECKS = [
  {
    id: 'referral',
    title: 'Referral mechanics',
    patterns: [/refer[-\s]?a[\s-]?friend/i, /invite\s+friends?/i, /give\s+\$\d+.*get\s+\$\d+/i,
      /referral/i, /earn\s+credit/i, /refer\s+and\s+earn/i],
    hit: 2, partial: 1,
    tip: 'Strongest signal: a referral flow with a visible reward for both sides.'
  },
  {
    id: 'share',
    title: 'Share buttons / virality',
    patterns: [/share/i, /tell\s+your\s+friends?/i, /spread\s+the\s+word/i,
      /whatsapp|telegram|twitter|facebook|linkedin/i],
    hit: 2, partial: 1,
    tip: 'One-tap sharing near high-emotion moments outperforms footer icons.'
  },
  {
    id: 'invite',
    title: 'Invite / team flows',
    patterns: [/invite\s+(your\s+)?team/i, /add\s+teammates?/i, /collaborat/i,
      /invite\s+members?/i, /seats?/i],
    hit: 2, partial: 1,
    tip: 'Multiplayer onboarding (bring your team) creates natural loops.'
  },
  {
    id: 'ugc',
    title: 'User-generated content',
    patterns: [/share\s+your/i, /showcase/i, /gallery/i, /community/i,
      /create\s+(your|a)\s+(own|profile|page)/i, /publish/i],
    hit: 2, partial: 1,
    tip: 'When users publish things, every artifact becomes an acquisition surface.'
  },
  {
    id: 'rewards',
    title: 'Rewards / gamification',
    patterns: [/reward/i, /points?/i, /badge/i, /streak/i, /leaderboard/i,
      /level\s+up/i, /unlock/i, /free\s+(month|credits?|trial)/i],
    hit: 2, partial: 1,
    tip: 'Rewards tied to inviting others close the loop; cosmetic rewards fade.'
  },
  {
    id: 'network',
    title: 'Network effects surface',
    patterns: [/follow/i, /connect/i, /network/i, /members?/i, /discover\s+people/i],
    hit: 2, partial: 1,
    tip: 'A follow graph or directory means each user increases product value.'
  }
];

/* ---------- page-side collector (injected, self-contained) ---------- */
function collectPage() {
  const body = document.body;
  if (!body) return { text: '', buttons: '', links: '' };
  const text = body.innerText.slice(0, 60000);
  const btns = [...body.querySelectorAll('button, a[role="button"], [class*="btn"], [class*="share"]')]
    .slice(0, 60).map((b) => (b.innerText || '').trim()).filter(Boolean).join(' || ');
  const hrefs = [...body.querySelectorAll('a[href]')].slice(0, 120)
    .map((a) => a.getAttribute('href') || '').filter(Boolean).join(' ');
  return { text, buttons: btns, links: hrefs };
}

/* ---------- scoring (popup side) ---------- */
function scoreCheck(check, data) {
  const hay = data.text + '\n' + data.buttons + '\n' + data.links;
  const hits = check.patterns.filter((re) => re.test(hay)).length;
  if (hits >= check.hit) return 'hit';
  if (hits >= check.partial) return 'partial';
  return 'miss';
}

function render(results) {
  const box = $('checks');
  box.innerHTML = '';
  let points = 0;
  for (const r of results) {
    points += r.state === 'hit' ? 2 : r.state === 'partial' ? 1 : 0;
    const div = document.createElement('div');
    div.className = 'check';
    div.innerHTML =
      '<div class="top"><span class="badge ' + r.state + '">' + r.state + '</span><h3>' + r.title + '</h3></div>' +
      '<p>' + r.detail + '</p>' +
      '<p class="tip">' + r.tip + '</p>';
    box.appendChild(div);
  }
  const max = results.length * 2;
  const pct = Math.round((points / max) * 100);
  $('score-wrap').classList.remove('hidden');
  $('score-num').textContent = pct;
  $('ring').style.background =
    `conic-gradient(var(--accent) ${pct * 3.6}deg, rgba(255,255,255,.08) 0deg)`;
  $('score-verdict').textContent =
    pct >= 70 ? 'Strong loop signals — worth instrumenting.' :
    pct >= 40 ? 'Some loop mechanics present.' :
    'Few loop signals detected on this page.';
}

/* ---------- events ---------- */
$('scan').addEventListener('click', async () => {
  $('status').textContent = 'Scanning…';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^(https?:|file:)/.test(tab.url)) {
    $('status').textContent = 'Open a regular web page first.';
    return;
  }
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectPage
    });
    const data = res.result;
    const results = CHECKS.map((c) => {
      const state = scoreCheck(c, data);
      const n = c.patterns.filter((re) =>
        (data.text + '\n' + data.buttons + '\n' + data.links).match(re)).length;
      return {
        state, title: c.title, tip: c.tip,
        detail: n === 0
          ? 'No matching signals found on this page.'
          : `${n} matching signal${n > 1 ? 's' : ''} found in page text and controls.`
      };
    });
    render(results);
    $('status').textContent = 'Scan complete — heuristic results, verify manually.';
  } catch (e) {
    $('status').textContent = 'Could not scan this page (protected or restricted).';
  }
});

$('clear').addEventListener('click', () => {
  $('checks').innerHTML = '';
  $('score-wrap').classList.add('hidden');
  $('status').textContent = 'Ready — click Scan on any landing page.';
});
