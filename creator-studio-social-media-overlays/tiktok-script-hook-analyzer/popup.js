/* Hook Analyzer — heuristic hook scoring, all client-side. */

const $ = (id) => document.getElementById(id);
const RING_C = 326.7; // 2 * PI * 52

/* Word lists for heuristics */
const QUESTION_STARTERS = ['how', 'what', 'why', 'when', 'who', 'where', 'which', 'can', 'do', 'does', 'is', 'are', 'have'];
const CURIOSITY_WORDS = ['secret', 'secrets', 'nobody', 'mistake', 'mistakes', 'stop', 'truth', 'hack', 'hacks', 'never', 'nobody tells', 'shocking', 'insane', 'crazy', 'weird', 'hidden', 'lie', 'lies', 'exposed', 'banned', 'illegal'];
const FILLER_PHRASES = ['hey guys', 'welcome back', 'in today\'s video', 'in this video', 'um ', 'uh ', 'like and subscribe', 'smash that'];
const POWER_OPENERS = ['pov', 'stop ', '3 ', '5 ', '7 ', '10 ', 'i tried', 'day ', 'warning'];

/**
 * Extract the hook: first 2 sentences, capped at ~220 chars.
 */
function extractHook(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  const hook = (sentences[0] + ' ' + (sentences[1] || '')).trim();
  return hook.length > 220 ? hook.slice(0, 220).trim() + '…' : hook;
}

/** Run all heuristic checks; returns { score, factors, suggestions }. */
function analyze(text) {
  const hook = extractHook(text);
  const lower = hook.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const factors = [];
  const suggestions = [];

  const push = (name, points, passed, tip) => {
    factors.push({ name, points, earned: passed ? points : 0 });
    if (!passed && tip) suggestions.push(tip);
  };

  // 1. Question opener (20)
  const firstWord = words[0] || '';
  const isQuestion = /[?]$/.test(hook.split(/[.!?]/)[0]) || QUESTION_STARTERS.includes(firstWord);
  push('Question opener — starts with or asks a question', 20, isQuestion,
    'Open with a question ("What if I told you…?") to spark instant curiosity.');

  // 2. Numbers / stats (15)
  const hasNumber = /\d/.test(hook);
  push('Numbers or stats — digits grab attention', 15, hasNumber,
    'Add a concrete number or stat ("I made $4,200 in 3 days") — digits stop thumbs.');

  // 3. Curiosity gap (15)
  const hasCuriosity = CURIOSITY_WORDS.some(w => lower.includes(w));
  push('Curiosity gap — unresolved tension words', 15, hasCuriosity,
    'Plant an open loop with words like "secret", "mistake", "nobody tells you", "stop".');

  // 4. Direct address (15)
  const hasYou = /\b(you|your|yours|you're|yourself)\b/.test(lower);
  push('Direct "you" address — speaks to the viewer', 15, hasYou,
    'Talk to the viewer directly ("If you\'re a creator, you need this").');

  // 5. Hook length (15)
  const len = hook.length;
  const goodLen = len > 0 && len <= 140;
  push('Snappy length — hook under 140 characters', 15, goodLen,
    `Trim the hook to under 140 characters (currently ${len}). First 3 seconds decide everything.`);

  // 6. Power opener (10)
  const hasPower = POWER_OPENERS.some(w => lower.startsWith(w)) || /^\d+\s/.test(lower);
  push('Pattern-interrupt opener — "POV", "Stop", number lead', 10, hasPower,
    'Lead with a pattern interrupt: "POV:", "Stop scrolling if…", or a number.');

  // 7. Filler-free (10)
  const hasFiller = FILLER_PHRASES.some(w => lower.includes(w));
  push('Zero filler — no intros or rambling openers', 10, !hasFiller,
    'Cut filler like "hey guys, welcome back" — start mid-action, not with an intro.');

  const score = factors.reduce((s, f) => s + f.earned, 0);
  return { score, factors, suggestions, hook };
}

function verdictFor(score) {
  if (score >= 80) return { label: 'Strong hook', cls: 'strong' };
  if (score >= 55) return { label: 'Decent — room to sharpen', cls: 'decent' };
  return { label: 'Needs work', cls: 'weak' };
}

/** Render the analysis into the DOM. */
function render({ score, factors, suggestions, hook }) {
  const result = $('result');
  result.classList.remove('hidden');

  // Animate ring + number
  const ring = $('ringFg');
  const num = $('scoreNum');
  const v = verdictFor(score);
  ring.style.stroke = score >= 80 ? '#34d399' : score >= 55 ? '#fbbf24' : '#f87171';
  ring.style.strokeDashoffset = RING_C;
  num.textContent = '0';
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = RING_C - (RING_C * score) / 100;
  });
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - start) / 700);
    num.textContent = Math.round(score * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const verdictEl = $('verdict');
  verdictEl.textContent = v.label;
  verdictEl.className = 'verdict ' + v.cls;

  $('hookQuote').textContent = '“' + hook + '”';

  $('factors').innerHTML = factors.map(f => `
    <li class="factor ${f.earned > 0 ? 'pass' : 'fail'}">
      <span class="dot"></span>
      <span class="fname">${f.name}</span>
      <span class="fpts">${f.earned}/${f.points}</span>
    </li>`).join('');

  const iconTip = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
  const iconOk = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  $('suggestions').innerHTML = suggestions.length
    ? suggestions.map(s => `<li class="suggestion">${iconTip}<span>${s}</span></li>`).join('')
    : `<li class="suggestion perfect">${iconOk}<span>Nothing to fix — this hook checks every box.</span></li>`;

  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

const SAMPLE = "Stop scrolling if you've ever felt invisible on TikTok. I posted 3 videos a day for 30 days and discovered the one mistake killing your reach — nobody talks about number 2. Here's exactly what to do instead.";

/* Restore last script (convenience, stored locally). */
chrome.storage.local.get('lastScript', (d) => {
  if (d.lastScript) $('script').value = d.lastScript;
});

$('analyze').addEventListener('click', () => {
  const text = $('script').value.trim();
  if (!text) {
    $('script').focus();
    return;
  }
  chrome.storage.local.set({ lastScript: text });
  render(analyze(text));
});

$('sample').addEventListener('click', () => {
  $('script').value = SAMPLE;
  chrome.storage.local.set({ lastScript: SAMPLE });
});

$('clear').addEventListener('click', () => {
  $('script').value = '';
  $('result').classList.add('hidden');
  chrome.storage.local.remove('lastScript');
});
