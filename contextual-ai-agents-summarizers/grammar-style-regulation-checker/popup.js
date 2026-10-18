// Grammar & Style Regulation Checker — all analysis runs on-device.
// Settings (word limit + banned phrases) persist in chrome.storage.local.

const $ = (id) => document.getElementById(id);

const DEFAULT_BANNED = ["very", "really", "just", "in order to", "utilize", "a lot"];
const DEFAULT_LIMIT = 25;

// --- text utilities -------------------------------------------------------

function splitSentences(text) {
  // Split on sentence-ending punctuation while keeping the text readable.
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'‘])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function wordsOf(sentence) {
  return sentence.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w));
}

function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]e|ed|es)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

// --- checks ---------------------------------------------------------------

const PASSIVE_RE = /\b(am|is|are|was|were|be|been|being)\b(?:\s+\w+){0,2}\s+\b\w+(?:ed|en)\b/i;
const REPEAT_RE = /\b([a-zA-Z]{2,})\s+\1\b/i;

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function analyze(text, settings) {
  const sentences = splitSentences(text);
  const banned = settings.banned.map((b) => b.trim().toLowerCase()).filter(Boolean);
  const findings = [];
  let totalWords = 0, totalSyl = 0;

  sentences.forEach((s, i) => {
    const words = wordsOf(s);
    totalWords += words.length;
    totalSyl += words.reduce((a, w) => a + syllables(w), 0);

    if (words.length > settings.limit) {
      findings.push({ cls: "long", type: "Long sentence",
        detail: `${words.length} words (limit ${settings.limit})`, sentence: s, idx: i });
    }
    if (PASSIVE_RE.test(s)) {
      findings.push({ cls: "passive", type: "Possible passive voice",
        detail: "Consider an active construction", sentence: s, idx: i });
    }
    for (const b of banned) {
      const re = new RegExp(`\\b${escRe(b)}\\b`, "i");
      if (re.test(s)) {
        findings.push({ cls: "banned", type: "Banned phrase",
          detail: `“${b}”`, sentence: s, idx: i });
        break; // one hit per banned list per sentence is enough
      }
    }
    const rm = s.match(REPEAT_RE);
    if (rm) {
      findings.push({ cls: "repeat", type: "Repeated word",
        detail: `“${rm[0]}”`, sentence: s, idx: i });
    }
  });

  const n = sentences.length || 1;
  const flesch = totalWords
    ? 206.835 - 1.015 * (totalWords / n) - 84.6 * (totalSyl / totalWords)
    : null;

  const counts = { passive: 0, long: 0, banned: 0, repeat: 0 };
  for (const f of findings) counts[f.cls]++;
  const score = Math.max(0, Math.min(100,
    100 - 6 * counts.passive - 4 * counts.long - 3 * counts.banned - 4 * counts.repeat));

  return { sentences, totalWords, flesch, findings, score };
}

function fleschLabel(f) {
  if (f == null) return "—";
  if (f >= 90) return "Very easy";
  if (f >= 80) return "Easy";
  if (f >= 70) return "Fairly easy";
  if (f >= 60) return "Standard";
  if (f >= 50) return "Fairly hard";
  if (f >= 30) return "Hard";
  return "Very hard";
}

// --- persistence ----------------------------------------------------------

async function loadSettings() {
  const { gsSettings } = await chrome.storage.local.get("gsSettings");
  return {
    limit: (gsSettings && gsSettings.limit) || DEFAULT_LIMIT,
    banned: (gsSettings && gsSettings.banned) || DEFAULT_BANNED.slice(),
  };
}

// --- rendering ------------------------------------------------------------

function snippet(s) {
  return s.length > 130 ? s.slice(0, 127).trimEnd() + "…" : s;
}

function render(result) {
  const chip = $("scoreChip");
  chip.hidden = false;
  chip.textContent = result.score;
  chip.style.color = result.score >= 80 ? "#10b981" : result.score >= 55 ? "#f5a623" : "#f06666";

  $("statsCard").hidden = false;
  $("stWords").textContent = result.totalWords;
  $("stSent").textContent = result.sentences.length;
  $("stFlesch").textContent = result.flesch == null ? "–" : result.flesch.toFixed(0);
  $("stIssues").textContent = result.findings.length;

  const note = $("fleschNote");
  if (result.flesch != null && result.flesch < 40) {
    note.hidden = false;
    note.textContent = `Readability: ${fleschLabel(result.flesch)} — short, active sentences will raise the score.`;
  } else note.hidden = true;

  const card = $("findCard"), box = $("findings");
  box.innerHTML = "";
  card.hidden = result.findings.length === 0;
  $("findCount").textContent = result.findings.length;
  for (const f of result.findings) {
    const el = document.createElement("div");
    el.className = "finding";
    const tag = document.createElement("span");
    tag.className = "tag " + f.cls;
    tag.textContent = f.type;
    const ctx = document.createElement("div");
    ctx.className = "ctx";
    const b = document.createElement("b");
    b.textContent = f.detail;
    const p = document.createElement("span");
    p.textContent = `Sentence ${f.idx + 1}: ${snippet(f.sentence)}`;
    ctx.append(b, p);
    el.append(tag, ctx);
    box.appendChild(el);
  }
  if (result.findings.length === 0) {
    $("statsCard").hidden = false;
  }
}

// --- init -----------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await loadSettings();
  $("wordLimit").value = settings.limit;
  $("banned").value = settings.banned.join("\n");

  $("analyze").addEventListener("click", async () => {
    const text = $("input").value.trim();
    if (!text) { $("input").focus(); return; }
    const s = await loadSettings();
    render(analyze(text, s));
  });

  $("saveRegs").addEventListener("click", async () => {
    const limit = Math.max(5, Math.min(100, parseInt($("wordLimit").value, 10) || DEFAULT_LIMIT));
    const banned = $("banned").value.split(/[\n,]+/).map((b) => b.trim()).filter(Boolean);
    await chrome.storage.local.set({ gsSettings: { limit, banned } });
    const msg = $("savedMsg");
    msg.hidden = false;
    setTimeout(() => { msg.hidden = true; }, 1600);
  });
});
