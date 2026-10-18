/* Community Comment Spam Purger — heuristic spam scoring (all local, all on-device)
 * This is an ANALYSIS tool only. It never deletes, hides, or reports anything.
 * Scores are heuristics and will have false positives — the user decides. */

'use strict';

/* ---------- signal definitions ---------- */
const SUSPICIOUS_KEYWORDS = [
  'free money', 'make money', 'get rich', 'guaranteed', 'click here', 'click the link',
  'link in bio', 'dm me', 'whatsapp', 'telegram', 'giveaway', 'you won', 'you\'ve won',
  'congratulations you', 'crypto', 'bitcoin giveaway', 'double your', 'forex',
  'discount code', 'promo code', 'limited time offer', 'act now', 'cash app',
  'send me', 'message me', 'follow for follow', 'sub for sub', 'check my profile',
  'earn $', 'work from home', 'no experience needed', 'weight loss', 'miracle'
];

const URL_RE = /(https?:\/\/[^\s)]+|www\.[^\s)]+|\b[a-z0-9-]+\.(com|net|org|io|co|xyz|top|site|online|click|link|vip)\b[^\s)]*)/gi;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;

/* ---------- scoring ---------- */
/**
 * Scores a comment 0–100 and returns { score, verdict, signals: [{name, points, detail, hit}] }.
 */
function scoreComment(text) {
  const signals = [];
  let score = 0;
  const t = text || '';

  const add = (name, points, detail, hit) => {
    points = Math.round(points);
    if (hit && points > 0) score += points;
    signals.push({ name, points: hit ? points : 0, detail, hit });
  };

  // 1. Excessive links (max 30)
  const urls = t.match(URL_RE) || [];
  add('Excessive links', Math.min(30, urls.length * 12), urls.length ? `${urls.length} link${urls.length > 1 ? 's' : ''} found` : 'no links', urls.length > 0);

  // 2. ALL CAPS ratio (max 20)
  const letters = (t.match(/[a-zA-Z]/g) || []);
  const upper = (t.match(/[A-Z]/g) || []).length;
  const capsRatio = letters.length >= 10 ? upper / letters.length : 0;
  add('ALL CAPS shouting', capsRatio > 0.5 ? Math.min(20, Math.round(capsRatio * 28)) : 0,
      letters.length >= 10 ? `${Math.round(capsRatio * 100)}% uppercase` : 'too short to judge', capsRatio > 0.5);

  // 3. Repeated phrases — repeated 3+ word n-grams (max 15)
  const words = t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const seen = new Map();
  let repeats = 0;
  for (let n = 3; n <= 5; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n).join(' ');
      const c = (seen.get(gram) || 0) + 1;
      seen.set(gram, c);
      if (c === 2) repeats++;
    }
  }
  add('Repeated phrases', Math.min(15, repeats * 8), repeats ? `${repeats} repeated phrase${repeats > 1 ? 's' : ''}` : 'no repetition', repeats > 0);

  // 4. Suspicious keywords (max 25)
  const lower = t.toLowerCase();
  const hits = SUSPICIOUS_KEYWORDS.filter(k => lower.includes(k));
  add('Suspicious keywords', Math.min(25, hits.length * 8),
      hits.length ? hits.slice(0, 3).join(', ') + (hits.length > 3 ? ` +${hits.length - 3} more` : '') : 'none found',
      hits.length > 0);

  // 5. Emoji spam (max 15)
  const emojis = t.match(EMOJI_RE) || [];
  add('Emoji spam', emojis.length > 4 ? Math.min(15, (emojis.length - 4) * 3) : 0,
      `${emojis.length} emoji${emojis.length === 1 ? '' : 's'}`, emojis.length > 4);

  // 6. Excessive punctuation !!! ??? (max 10)
  const bangs = (t.match(/!{2,}|\?{2,}/g) || []).length;
  add('Excessive punctuation', Math.min(10, bangs * 4), bangs ? `${bangs} burst${bangs > 1 ? 's' : ''}` : 'normal', bangs > 0);

  // 7. Very long run-on / gibberish check (max 5)
  const avgWord = words.length ? words.join('').length / words.length : 0;
  const gibberish = avgWord > 12 && words.length > 5;
  add('Gibberish-like text', gibberish ? 5 : 0, gibberish ? 'unusually long tokens' : 'normal', gibberish);

  score = Math.min(100, score);
  const verdict = score >= 75 ? 'Spam' : score >= 50 ? 'Likely spam' : score >= 25 ? 'Suspicious' : 'Likely clean';
  return { score, verdict, signals };
}

function verdictClass(verdict) {
  return { 'Likely clean': 'clean', 'Suspicious': 'suspicious', 'Likely spam': 'spam', 'Spam': 'blatant' }[verdict] || 'clean';
}

/* ---------- single-comment UI ---------- */
function renderSingle(result) {
  const box = document.getElementById('singleResult');
  box.hidden = false;
  document.getElementById('scoreNum').textContent = result.score;
  const v = document.getElementById('scoreVerdict');
  v.textContent = result.verdict;
  v.style.color = { 'Likely clean': '#22c55e', 'Suspicious': '#eab308', 'Likely spam': '#f97316', 'Spam': '#ef4444' }[result.verdict];

  const C = 2 * Math.PI * 40; // 251.3
  document.getElementById('ringArc').style.strokeDashoffset = String(C * (1 - result.score / 100));

  const list = document.getElementById('signalList');
  list.innerHTML = '';
  for (const s of result.signals) {
    const row = document.createElement('div');
    row.className = 'signal';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = s.hit ? (s.points >= 15 ? '#ef4444' : s.points >= 8 ? '#f97316' : '#eab308') : '#3a3a44';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = s.name;
    const pts = document.createElement('span');
    pts.className = 'pts';
    pts.textContent = s.hit ? `+${s.points}` : '0';
    row.append(dot, name, pts);
    list.appendChild(row);
    if (s.hit && s.detail) {
      const det = document.createElement('div');
      det.className = 'signal';
      const d2 = document.createElement('span');
      d2.className = 'detail';
      d2.textContent = '↳ ' + s.detail;
      det.appendChild(d2);
      list.appendChild(det);
    }
  }
}

/* ---------- batch UI ---------- */
function renderBatch(comments) {
  const results = comments.map(c => ({ text: c, ...scoreComment(c) }));
  results.sort((a, b) => b.score - a.score);
  const flagged = results.filter(r => r.score >= 50).length;

  const summary = document.getElementById('batchSummary');
  summary.hidden = false;
  summary.innerHTML = `<span>Scored <b>${results.length}</b> comments</span><span><b>${flagged}</b> flagged ≥ 50</span>`;

  const list = document.getElementById('batchList');
  list.innerHTML = '';
  for (const r of results) {
    const row = document.createElement('div');
    row.className = 'batch-row';
    const top = document.createElement('div');
    top.className = 'batch-top';
    const badge = document.createElement('span');
    badge.className = 'badge ' + verdictClass(r.verdict);
    badge.textContent = `${r.score} · ${r.verdict}`;
    top.appendChild(badge);
    const txt = document.createElement('div');
    txt.className = 'batch-text';
    txt.textContent = r.text;
    row.append(top, txt);
    list.appendChild(row);
  }
}

/* ---------- init ---------- */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    const single = tab.dataset.mode === 'single';
    document.getElementById('singlePane').hidden = !single;
    document.getElementById('batchPane').hidden = single;
  });
});

document.getElementById('analyzeBtn').addEventListener('click', () => {
  const text = document.getElementById('singleInput').value.trim();
  if (!text) return;
  renderSingle(scoreComment(text));
});

document.getElementById('batchBtn').addEventListener('click', () => {
  const raw = document.getElementById('batchInput').value;
  const comments = raw.split(/\n{2,}|\r{2,}/).map(s => s.trim()).filter(Boolean);
  if (!comments.length) return;
  renderBatch(comments);
});

// Smoke-test the scorer logic on load (dev sanity; invisible to user)
(function selfTest() {
  const a = scoreComment('Great video, really helped me understand this topic. Thanks!');
  const b = scoreComment('FREE MONEY!!! Click here NOW www.scam-link.xyz guaranteed $$$ DM me on whatsapp!!!');
  if (typeof console !== 'undefined' && (a.score > 25 || b.score < 50)) {
    console.warn('[spam-purger] scorer self-test drift', a.score, b.score);
  }
})();
