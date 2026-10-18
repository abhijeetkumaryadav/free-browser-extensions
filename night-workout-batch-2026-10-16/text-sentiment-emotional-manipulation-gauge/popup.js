/* Sentiment Signal Gauge — heuristic sentiment + manipulation-signal scanner.
 * HEURISTIC ONLY: weighted lexicon matching. No AI, no psychology — just word counting. */

'use strict';

// ===================== ENGINE-START =====================
// Weighted sentiment lexicon (word -> polarity weight -2..+2)
const POS_WORDS = {
  love:2, wonderful:2, excellent:2, fantastic:2, amazing:2, great:1, good:1,
  happy:1, joyful:2, delighted:2, brilliant:2, awesome:2, perfect:2,
  beautiful:1, grateful:1, proud:1, hopeful:1, inspired:2, kind:1,
  generous:1, success:1, successful:1, win:1, winning:1, celebrate:1,
  peace:1, peaceful:1, thrive:1, thriving:1, opportunity:1, exciting:1
};
const NEG_WORDS = {
  hate:2, terrible:2, awful:2, horrible:2, disgusting:2, dreadful:2,
  bad:1, sad:1, angry:2, furious:2, enraged:2, afraid:1, fear:2,
  fearful:1, worried:1, anxious:1, disappointed:1, shameful:2, ashamed:1,
  failure:1, fail:1, lose:1, losing:1, crisis:2, disaster:2, catastrophic:2,
  dangerous:1, threat:2, threatening:2, death:1, kill:2, destroy:2,
  corrupt:2, lie:1, lies:1, betray:2, treacherous:2, outrageous:2
};
// Manipulation signal patterns: [key, label, plain-language note, matchers]
const SIGNAL_RULES = [
  {
    key: 'loaded',
    label: 'Loaded language',
    note: 'Emotionally charged words add rhetorical heat. Heat is not evidence.',
    words: ['outrageous','treacherous','disgusting','shocking','shocking','unbelievable',
            'devastating','catastrophic','corrupt','evil','pathetic','stupid',
            'idiotic','moronic','disgraceful','shameful','horrifying','appalling']
  },
  {
    key: 'urgency',
    label: 'False urgency',
    note: 'Time pressure pushes you to decide before the facts are checked.',
    phrases: ['act now','right now','immediately','before it\'s too late','before it is too late',
              'last chance','limited time','don\'t wait','do not wait','hurry',
              'ending soon','expires soon','only hours left','today only','once in a lifetime']
  },
  {
    key: 'fear',
    label: 'Fear / threat cues',
    note: 'Loss and danger language can bypass calm reasoning.',
    words: ['catastrophe','catastrophic','dangerous','threat','threatening','disaster',
            'you\'ll lose','you will lose','lose everything','destroy','destroyed',
            'kill','death','doom','collapse','ruin']
  },
  {
    key: 'flattery',
    label: 'Flattery / in-group praise',
    note: 'Warmth aimed at you lowers skepticism before the ask.',
    phrases: ['smart people like you','people like you','you deserve','you\'re special',
              'you are special','for smart readers','as someone who knows','unlike most people']
  }
];

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []);
}

// Sentiment score in [-100, +100]: (pos - neg) weighted hits per 100 words, scaled.
function sentimentScore(text) {
  const words = tokenize(text);
  if (words.length === 0) return null;
  let pos = 0, neg = 0;
  for (const w of words) {
    if (POS_WORDS[w]) pos += POS_WORDS[w];
    if (NEG_WORDS[w]) neg += NEG_WORDS[w];
  }
  const per100 = ((pos - neg) / words.length) * 100;
  return Math.max(-100, Math.min(100, Math.round(per100 * 8))); // scale up: word hits are rare
}

function sentimentVerdict(score) {
  if (score === null) return 'No text';
  if (score >= 40) return 'Strongly positive';
  if (score >= 15) return 'Mildly positive';
  if (score > -15) return 'Neutral / mixed';
  if (score > -40) return 'Mildly negative';
  return 'Strongly negative';
}

// Count manipulation-signal hits per rule.
function detectSignals(text) {
  const lower = ' ' + text.toLowerCase() + ' ';
  const words = tokenize(text);
  const hits = [];
  for (const rule of SIGNAL_RULES) {
    let count = 0;
    const found = [];
    if (rule.words) {
      const set = new Set(rule.words);
      for (const w of words) if (set.has(w)) { count++; if (found.length < 3) found.push(w); }
    }
    if (rule.phrases) {
      for (const p of rule.phrases) {
        const idx = lower.indexOf(p);
        if (idx !== -1) { count++; if (found.length < 3) found.push(p); }
      }
    }
    if (count > 0) hits.push({ key: rule.key, label: rule.label, note: rule.note, count, found });
  }
  // Shouting style: exclamation density + ALL-CAPS sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const capsSentences = sentences.filter(s => {
    const letters = s.replace(/[^A-Za-z]/g, '');
    return letters.length >= 6 && letters === letters.toUpperCase();
  }).length;
  const excl = (text.match(/!/g) || []).length;
  const shoutCount = (excl >= 3 ? 1 : 0) + capsSentences;
  if (shoutCount > 0) {
    hits.push({
      key: 'shout', label: 'Shouting style', count: shoutCount,
      note: 'Exclamation density and ALL-CAPS. A raised voice, not raised evidence.',
      found: excl >= 3 ? ['!!!'] : ['ALL-CAPS']
    });
  }
  return hits;
}

function makeNote(title, body) {
  title = (title || '').trim();
  body = (body || '').trim();
  if (!title && !body) return null;
  return { id: 'n' + Date.now().toString(36), title: title.slice(0, 80), body: body.slice(0, 2000), ts: Date.now() };
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => b.ts - a.ts);
}

function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
// ===================== ENGINE-END =====================

// --------------------- UI wiring ---------------------
const $ = id => document.getElementById(id);

// Tabs
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('panel-' + btn.dataset.tab).classList.add('active');
  });
});

$('scanBtn').addEventListener('click', () => {
  const text = $('input').value;
  const score = sentimentScore(text);
  const signals = detectSignals(text);
  const res = $('results');
  res.classList.remove('hidden');

  if (score === null) {
    $('sentScore').textContent = '–';
    $('sentVerdict').textContent = 'No text';
    $('needle').style.transform = 'rotate(-90deg)';
  } else {
    $('sentScore').textContent = (score > 0 ? '+' : '') + score;
    $('sentVerdict').textContent = sentimentVerdict(score);
    // -100..+100 maps to -90..+90deg rotation
    const deg = (score / 100) * 90;
    $('needle').style.transform = 'rotate(' + deg + 'deg)';
  }

  const words = tokenize(text).length;
  $('statGrid').innerHTML =
    stat(words, 'words scanned') +
    stat(signals.reduce((n, s) => n + s.count, 0), 'signal hits') +
    stat(signals.length, 'signal types');

  const list = $('signalList');
  list.innerHTML = '';
  $('noSignals').classList.toggle('hidden', signals.length > 0);
  for (const s of signals) {
    const div = document.createElement('div');
    div.className = 'signal';
    div.innerHTML = '<h4>' + esc(s.label) + '<span class="count">×' + s.count + '</span></h4>' +
      '<p>' + esc(s.note) + ' Matched: ' + esc(s.found.join(', ')) + '.</p>';
    list.appendChild(div);
  }

  // Remember last pasted text locally
  chrome.storage.local.set({ lastText: text.slice(0, 5000) });
});

function stat(num, label) {
  return '<div class="stat"><b>' + num + '</b><span>' + label + '</span></div>';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Restore last pasted text
chrome.storage.local.get(['lastText'], r => { if (r.lastText) $('input').value = r.lastText; });

// Notes
let notes = [];
function renderNotes() {
  const list = $('noteList');
  list.innerHTML = '';
  for (const n of sortNotes(notes)) {
    const div = document.createElement('div');
    div.className = 'note';
    div.innerHTML = '<h4>' + esc(n.title || '(untitled)') + '</h4>' +
      (n.body ? '<p>' + esc(n.body) + '</p>' : '') +
      '<div class="row"><time>' + esc(fmtWhen(n.ts)) + '</time><button data-id="' + n.id + '">Delete</button></div>';
    list.appendChild(div);
  }
  list.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      notes = notes.filter(n => n.id !== b.dataset.id);
      chrome.storage.local.set({ notes });
      renderNotes();
    });
  });
}
$('addNote').addEventListener('click', () => {
  const n = makeNote($('noteTitle').value, $('noteBody').value);
  if (!n) return;
  notes.push(n);
  chrome.storage.local.set({ notes });
  $('noteTitle').value = '';
  $('noteBody').value = '';
  renderNotes();
});
chrome.storage.local.get(['notes'], r => { notes = r.notes || []; renderNotes(); });
