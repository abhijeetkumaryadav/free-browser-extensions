/**
 * popup.js — ReadingLens analysis orchestration and readability math.
 *
 * All computation happens locally in the popup. The content script is only
 * injected into the active tab when the user clicks "Analyze this page".
 */

'use strict';

// Common English stopwords excluded from keyword ranking.
const STOPWORDS = new Set(
  'a,an,the,and,or,but,if,then,else,when,while,of,at,by,for,with,about,into,' +
  'through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,' +
  'under,again,further,once,here,there,all,any,both,each,few,more,most,other,' +
  'some,such,no,nor,not,only,own,same,so,than,too,very,can,will,just,don,should,' +
  'now,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,' +
  'would,could,ought,i,you,he,she,it,we,they,them,his,her,its,our,their,this,' +
  'that,these,those,as,say,said,also,new,one,two,may,might,must,shall,like,' +
  'get,got,made,make,many,much,well,us,your,which,who,whom,what,where,why,how'
    .split(',')
);

/** Estimate syllable count for one word (vowel-group heuristic). */
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]e|ed|es)$/, '').replace(/^y/, '');
  const groups = word.match(/[aeiouy]{1,2}/g);
  return Math.max(groups ? groups.length : 0, 1);
}

/** Split text into word tokens. */
function tokenize(text) {
  return (text.toLowerCase().match(/[a-z][a-z'\-]*[a-z]/g) || []);
}

/** Rank non-stopword tokens and return the top N as [word, count]. */
function topKeywords(text, n = 10) {
  const counts = new Map();
  for (const w of tokenize(text)) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

const $ = id => document.getElementById(id);

function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

/** Run the full readability analysis and render results. */
function analyze(text, title, wpm) {
  const words = tokenize(text);
  const wordCount = words.length;
  const sentences = text.split(/[.!?…]+/).filter(s => s.trim().length > 1);
  const sentenceCount = Math.max(sentences.length, 1);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const wps = wordCount / sentenceCount;
  const spw = wordCount ? syllables / wordCount : 0;
  const grade = 0.39 * wps + 11.8 * spw - 15.59;                    // Flesch–Kincaid grade
  const ease = 206.835 - 1.015 * wps - 84.6 * spw;                 // Flesch reading ease
  const minutes = wordCount / wpm;

  let verdict, cls;
  if (grade < 6)      { verdict = 'Easy read';     cls = ''; }
  else if (grade < 10){ verdict = 'Moderate';     cls = 'moderate'; }
  else                { verdict = 'Dense';        cls = 'dense'; }

  const fmtMinutes = minutes < 1
    ? `${Math.max(Math.round(minutes * 60), 1)} sec`
    : `${Math.floor(minutes)} min ${Math.round((minutes % 1) * 60)} sec`;

  $('pageTitle').textContent = title;
  $('words').textContent = wordCount.toLocaleString();
  $('minutes').textContent = fmtMinutes;
  $('grade').textContent = Math.max(grade, 0).toFixed(1);
  $('sentences').textContent = sentenceCount.toLocaleString();
  const verdictEl = $('verdict');
  verdictEl.textContent = verdict;
  verdictEl.className = 'verdict' + (cls ? ' ' + cls : '');
  $('ease').textContent = `Reading ease ${Math.max(Math.min(ease, 100), 0).toFixed(0)}/100`;

  const chips = $('keywords');
  chips.innerHTML = '';
  for (const [word, count] of topKeywords(text)) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.textContent = word + ' ';
    const c = document.createElement('span');
    c.className = 'count';
    c.textContent = `×${count}`;
    span.appendChild(c);
    chips.appendChild(span);
  }
  $('results').classList.remove('hidden');
}

/** Inject the extractor into the active tab and analyze the result. */
async function onAnalyze() {
  const btn = $('analyzeBtn');
  const wpm = parseInt($('wpm').value, 10);
  btn.disabled = true;
  setStatus('Analyzing…');
  $('results').classList.add('hidden');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.url?.startsWith('chrome://') || tab.url?.startsWith('edge://')) {
      throw new Error('Extensions cannot analyze internal browser pages.');
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    if (!result || !result.ok) {
      throw new Error(result?.reason || 'Could not extract article text.');
    }
    analyze(result.text, result.title, wpm);
    setStatus(`Analyzed ${result.text.length.toLocaleString()} characters.`);
  } catch (err) {
    setStatus(err.message || 'Analysis failed.', true);
  } finally {
    btn.disabled = false;
  }
}

/** Restore the saved reading speed. */
async function init() {
  const { wpm = 200 } = await chrome.storage.local.get('wpm');
  $('wpm').value = wpm;
  $('wpmVal').textContent = `${wpm} wpm`;
  $('wpm').addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    $('wpmVal').textContent = `${v} wpm`;
    chrome.storage.local.set({ wpm: v });
  });
  $('analyzeBtn').addEventListener('click', onAnalyze);
}

document.addEventListener('DOMContentLoaded', init);
