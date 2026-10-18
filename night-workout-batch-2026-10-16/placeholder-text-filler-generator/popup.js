// Lorem Forge — placeholder text generator (fully local).
//
// Two word lists: classic Latin-flavored lorem ipsum and a playful
// "startup ipsum" of buzzwords. Sentences are assembled word-by-word with a
// seeded RNG so output is reproducible per generation run but varied.

/* ------------------------------------------------------------------ */
/* word lists                                                          */
/* ------------------------------------------------------------------ */

const CLASSIC_WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud ' +
  'exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute ' +
  'irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur ' +
  'excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt ' +
  'mollit anim id est laborum perspiciatis unde omnis iste natus error voluptatem ' +
  'accusantium doloremque laudantium totam rem aperiam eaque ab illo inventore ' +
  'veritatis quasi architecto beatae vitae dicta explicabo nemo enim ipsam ' +
  'voluptatem quia voluptas aspernatur odit aut fugit consequuntur magni dolores ' +
  'eos ratione sequi nesciunt neque porro quisquam dolorem numquam eius modi ' +
  'tempora incidunt magnam quaerat'
).split(' ');

const STARTUP_WORDS = (
  'synergy disrupt pivot leverage scale agile blockchain ai-driven cloud-native ' +
  'growth hacking paradigm shift deep dive bandwidth circle back touch base ' +
  'move the needle low-hanging fruit boil the ocean drink our own champagne ' +
  'dogfood unicorn decacorn run rate burn multiple net retention expansion ' +
  'flywheel network effects moat tam sam som go-to-market product-market fit ' +
  'mvp north star metric okrs kpi dashboard funnel cohort churn upsell ' +
  'cross-sell land and expand freemium plg enterprise-grade soc2 zero-trust ' +
  'edge computing serverless microservices monorepo ci/cd devops finops ' +
  'llm rag vector embedding copilot agent swarms token context window ' +
  'hallucination guardrails evals red teaming human in the loop'
).split(' ');

const CLASSIC_OPENER = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

/* ------------------------------------------------------------------ */
/* generation                                                          */
/* ------------------------------------------------------------------ */

// Tiny mulberry32 PRNG — deterministic per run, no external deps.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// One sentence: 6–16 words, capitalized, ending with . ! or ?
function makeSentence(rand, words) {
  const len = 6 + Math.floor(rand() * 11);
  const parts = [];
  for (let i = 0; i < len; i++) parts.push(pick(rand, words));
  let s = capitalize(parts.join(' '));
  const end = rand();
  s += end < 0.85 ? '.' : end < 0.95 ? '!' : '?';
  return s;
}

// One paragraph: 4–7 sentences.
function makeParagraph(rand, words) {
  const n = 4 + Math.floor(rand() * 4);
  const out = [];
  for (let i = 0; i < n; i++) out.push(makeSentence(rand, words));
  return out.join(' ');
}

// Main entry: returns { text, wordCount, sentenceCount }.
function generate({ mode, count, flavor, startClassic }) {
  const words = flavor === 'startup' ? STARTUP_WORDS : CLASSIC_WORDS;
  const rand = rng(Date.now() ^ (Math.random() * 0xffffffff));
  count = Math.max(1, Math.min(100, count | 0));

  if (mode === 'words') {
    const picked = [];
    for (let i = 0; i < count; i++) picked.push(pick(rand, words));
    const text = picked.join(' ');
    return { text, wordCount: count, sentenceCount: 0 };
  }

  if (mode === 'sentences') {
    const sentences = [];
    for (let i = 0; i < count; i++) sentences.push(makeSentence(rand, words));
    const text = sentences.join(' ');
    return { text, wordCount: text.split(/\s+/).length, sentenceCount: count };
  }

  // paragraphs
  const paras = [];
  if (startClassic && flavor === 'classic') paras.push(CLASSIC_OPENER);
  while (paras.length < count) paras.push(makeParagraph(rand, words));
  const text = paras.slice(0, count).join('\n\n');
  const sentenceCount = (text.match(/[.!?]/g) || []).length;
  return { text, wordCount: text.split(/\s+/).length, sentenceCount };
}

/* ------------------------------------------------------------------ */
/* popup wiring                                                        */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);
const els = {
  mode: $('mode'),
  count: $('count'),
  flavor: $('flavor'),
  startClassic: $('startClassic'),
  gen: $('genBtn'),
  copy: $('copyBtn'),
  preview: $('preview'),
  stats: $('stats'),
  status: $('status'),
};

let lastText = '';

function flash(msg, ok = true) {
  els.status.textContent = msg;
  els.status.className = 'status' + (ok ? ' ok' : '');
  setTimeout(() => { els.status.textContent = ''; els.status.className = 'status'; }, 3000);
}

function render({ text, wordCount, sentenceCount }) {
  lastText = text;
  els.preview.textContent = text;
  els.preview.classList.add('real');
  const bits = [`${wordCount} words`];
  if (sentenceCount) bits.push(`${sentenceCount} sentences`);
  els.stats.textContent = '· ' + bits.join(' · ');
}

async function loadPrefs() {
  const p = await chrome.storage.local.get({ mode: 'paragraphs', count: 3, flavor: 'classic', startClassic: true });
  els.mode.value = p.mode;
  els.count.value = p.count;
  els.flavor.value = p.flavor;
  els.startClassic.checked = !!p.startClassic;
}

async function savePrefs() {
  await chrome.storage.local.set({
    mode: els.mode.value,
    count: parseInt(els.count.value, 10) || 1,
    flavor: els.flavor.value,
    startClassic: els.startClassic.checked,
  });
}

els.gen.addEventListener('click', async () => {
  const res = generate({
    mode: els.mode.value,
    count: parseInt(els.count.value, 10) || 1,
    flavor: els.flavor.value,
    startClassic: els.startClassic.checked,
  });
  render(res);
  await savePrefs();
  flash('Generated.');
});

els.copy.addEventListener('click', async () => {
  if (!lastText) {
    flash('Generate some text first.', false);
    return;
  }
  try {
    await navigator.clipboard.writeText(lastText);
    flash('Copied to clipboard.');
  } catch {
    // Fallback: select the preview text for manual copy.
    const range = document.createRange();
    range.selectNodeContents(els.preview);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    flash('Clipboard blocked — text selected, press Ctrl+C.', false);
  }
});

loadPrefs().catch(() => {});
