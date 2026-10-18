/* ============================================================
   Vocab Quiz Generator — heuristic quiz engine (NO AI).
   Takes the user's pasted text and builds two question types:
     1. blank-out: a sentence with a content word replaced by ______
     2. word-match: pick the sentence where a given word appears
   Pure functions between ENGINE markers are headless-testable.
   ============================================================ */
"use strict";

/* // ENGINE-START */

// ~120 common English stopwords; everything else is a candidate content word.
const STOPWORDS = new Set(
  ("a,an,the,and,or,but,if,then,else,when,while,of,at,by,for,with,about,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,once,here,there,when,where,why,how,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,can,will,just,don,should,now,i,you,he,she,it,we,they,them,his,her,its,our,their,this,that,these,those,am,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,would,could,ought,my,your,his,her,its,our,their,as,also,one,two,three,may,might,must,shall,what,which,who,whom,whose,between,within,without,upon,among,across,along,around,until,toward,towards,against,into,per,via,say,said,like,get,got,make,made,take,took,go,went,come,came,see,saw,know,knew,think,thought" +
   ",although,though,since,because,unless,until,whether,either,neither,both,rather,quite,very,much,many,little,less,least,most,often,always,never,sometimes,usually,generally,however,therefore,thus,hence,indeed,still,yet,already,even,only,just,simply,merely,almost,nearly,quite,enough").split(",")
);

/** Split text into sentences (handles common abbreviations). */
function splitSentences(text) {
  const ABBR = ["mr","mrs","ms","dr","prof","sr","jr","st","vs","etc","e.g","i.e"];
  // Protect abbreviations from the splitter.
  let t = text.replace(/\s+/g, " ").trim();
  for (const a of ABBR) {
    const re = new RegExp(`\\b${a.replace(/\./g,"\\.")}\\.` , "gi");
    t = t.replace(re, a + "§");
  }
  const parts = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/);
  return parts.map(s => s.replace(/§/g, ".").trim()).filter(s => s.length > 3);
}

/** Lowercased word tokens from a sentence. */
function wordsOf(sentence) {
  return (sentence.toLowerCase().match(/[a-zà-ÿ'-]+/gi) || [])
    .map(w => w.replace(/^['-]+|['-]+$/g, ""))
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Build blank-out questions: pick sentences with >=4 content words,
 * blank the longest content word (or a random-ish deterministic pick).
 */
function buildBlankQuestions(sentences, n, seedStart) {
  const qs = [];
  const usable = sentences.filter(s => wordsOf(s).length >= 4);
  for (let i = 0; i < usable.length && qs.length < n; i++) {
    const s = usable[(seedStart + i) % usable.length];
    const cands = wordsOf(s);
    // Deterministic pick: longest word, tie → the one at index seedStart.
    let pick = cands[0];
    for (const w of cands) if (w.length > pick.length) pick = w;
    const re = new RegExp(`\\b${escapeRe(pick)}\\b`, "i");
    const display = s.replace(re, "______");
    if (display === s) continue;
    qs.push({ type: "blank", sentence: display, answer: pick.toLowerCase() });
  }
  return qs;
}

/**
 * Build word-match questions: given a content word, choose which of
 * 3 sentences it appears in. Options are sentences (shuffled).
 */
function buildMatchQuestions(sentences, n, seedStart) {
  const qs = [];
  const usable = sentences.filter(s => wordsOf(s).length >= 5);
  if (usable.length < 3) return qs;
  for (let i = 0; i < usable.length && qs.length < n; i++) {
    const correct = usable[(seedStart + i) % usable.length];
    const word = wordsOf(correct)[seedStart % wordsOf(correct).length] || wordsOf(correct)[0];
    const distractors = [];
    for (let j = 1; j <= usable.length && distractors.length < 2; j++) {
      const c = usable[(seedStart + i + j) % usable.length];
      if (c !== correct && !c.toLowerCase().includes(word)) distractors.push(c);
    }
    if (distractors.length < 2) continue;
    const options = shuffle([correct, ...distractors], seedStart + i);
    qs.push({ type: "match", word, options, answer: options.indexOf(correct) });
  }
  return qs;
}

/** Deterministic seeded shuffle (mulberry32). */
function shuffle(arr, seed) {
  const a = arr.slice();
  let s = seed >>> 0 || 1;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Escape a string for use in a RegExp. */
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** Compare typed answer to expected (case-insensitive, trimmed). */
function checkAnswer(expected, given) {
  return (given || "").trim().toLowerCase() === expected.toLowerCase();
}

/**
 * Generate a mixed quiz of up to n questions from raw text.
 * Alternates blank-out and word-match questions deterministically.
 */
function generateQuiz(text, n) {
  const sentences = splitSentences(text);
  if (sentences.length < 3) return { error: "Need at least 3 sentences of text." };
  const blanks = buildBlankQuestions(sentences, Math.ceil(n / 2), 0);
  const matches = buildMatchQuestions(sentences, Math.floor(n / 2), 3);
  const questions = [];
  const max = Math.max(blanks.length, matches.length);
  for (let i = 0; i < max && questions.length < n; i++) {
    if (i < blanks.length) questions.push(blanks[i]);
    if (questions.length < n && i < matches.length) questions.push(matches[i]);
  }
  if (questions.length < 2) return { error: "Not enough usable sentences — try longer text." };
  return { questions };
}

/* // ENGINE-END */

/* ---------------- popup UI ---------------- */

const $ = id => document.getElementById(id);
const viewBuild = $("viewBuild"), viewQuiz = $("viewQuiz");

let quiz = null;

chrome.storage.local.get("lastText", ({ lastText }) => {
  if (lastText) $("txt").value = lastText;
});

$("gen").addEventListener("click", () => {
  const text = $("txt").value.trim();
  const n = Math.min(20, Math.max(2, parseInt($("numQ").value, 10) || 8));
  const err = $("genErr");
  if (!text) { err.hidden = false; err.textContent = "Paste some text first."; return; }
  const res = generateQuiz(text, n);
  if (res.error) { err.hidden = false; err.textContent = res.error; return; }
  err.hidden = true;
  quiz = res.questions;
  chrome.storage.local.set({ lastText: text });
  renderQuiz();
  viewBuild.hidden = true; viewQuiz.hidden = false;
});

$("quit").addEventListener("click", () => {
  viewQuiz.hidden = true; viewBuild.hidden = false;
  $("result").hidden = true;
});

function renderQuiz() {
  $("qCount").textContent = quiz.length + " questions";
  const wrap = $("qWrap");
  wrap.innerHTML = "";
  quiz.forEach((q, i) => {
    const card = document.createElement("div");
    card.className = "qcard";
    card.dataset.i = i;
    if (q.type === "blank") {
      card.innerHTML =
        `<div class="qtype">Fill in the blank</div>` +
        `<p>${escapeHtml(q.sentence)}</p>` +
        `<input class="ans" placeholder="Type the missing word…" autocomplete="off">` +
        `<div class="feedback" hidden></div>`;
    } else {
      card.innerHTML =
        `<div class="qtype">Word match</div>` +
        `<p>Which sentence contains the word <b class="blank">${escapeHtml(q.word)}</b>?</p>` +
        q.options.map((o, oi) =>
          `<div class="chip" data-oi="${oi}">${escapeHtml(truncate(o, 90))}</div>`).join("") +
        `<div class="matchOpts"></div><div class="feedback" hidden></div>`;
      // Put chips into the matchOpts container.
      const chips = card.querySelectorAll(".chip");
      const holder = card.querySelector(".matchOpts");
      chips.forEach(c => holder.appendChild(c));
      holder.addEventListener("click", e => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        holder.querySelectorAll(".chip").forEach(c => c.classList.remove("sel"));
        chip.classList.add("sel");
        card.dataset.choice = chip.dataset.oi;
      });
    }
    wrap.appendChild(card);
  });
  $("result").hidden = true;
}

$("score").addEventListener("click", () => {
  let correct = 0;
  document.querySelectorAll(".qcard").forEach(card => {
    const i = parseInt(card.dataset.i, 10);
    const q = quiz[i];
    const fb = card.querySelector(".feedback");
    fb.hidden = false;
    let ok = false;
    if (q.type === "blank") {
      const given = card.querySelector("input.ans").value;
      ok = checkAnswer(q.answer, given);
      fb.textContent = ok ? "✓ Correct" : `✗ The word was “${q.answer}”.`;
    } else {
      const choice = card.dataset.choice;
      ok = choice !== undefined && parseInt(choice, 10) === q.answer;
      fb.textContent = ok ? "✓ Correct" : "✗ Not that one — it was the highlighted sentence.";
      if (!ok) {
        card.querySelectorAll(".chip").forEach(c => {
          if (parseInt(c.dataset.oi, 10) === q.answer) {
            c.style.borderColor = "#34d399"; c.style.background = "rgba(52,211,153,.15)";
          }
        });
      }
    }
    fb.className = "feedback " + (ok ? "ok" : "no");
    card.classList.toggle("correct", ok);
    card.classList.toggle("wrong", !ok);
    if (ok) correct++;
  });
  const r = $("result");
  r.hidden = false;
  r.textContent = `Score: ${correct} / ${quiz.length}`;
});

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
          .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
