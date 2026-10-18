/* Video Hook Signals — heuristic engine + UI.
   Pure functions live between the ENGINE markers. */

// ENGINE-START

/* Six hand-written hook signals. Each has an id, name, plain-language note,
   and a detector. Detectors return { hit: boolean, hits: string[], weight }.
   Heuristic signals only — they cannot predict retention or views. */
const SIGNALS = [
  {
    id: "question",
    name: "Question opener",
    note: "Opens with a question. A question can raise curiosity — but only if the answer feels worth waiting for.",
    weight: 18,
    detect(text) {
      const first = text.trim().split(/(?<=[.!?])\s+/)[0] || "";
      const q = /^\s*(what|why|how|when|where|who|which|is|are|do|does|did|can|could|have|has|would|should)\b/i.test(first) || first.includes("?");
      return { hit: q, hits: q ? [first.trim().slice(0, 80)] : [] };
    }
  },
  {
    id: "curiosity",
    name: "Curiosity-gap words",
    note: "Words that tease hidden information (secret, mistake, never, nobody…). Gap words can backfire if the payoff never lands.",
    weight: 20,
    detect(text) {
      const list = ["secret", "mistake", "never", "nobody", "no one", "hidden", "truth", "lies", "exposed", "banned", "nobody talks about", "they don't want", "stop doing", "you're doing it wrong"];
      const low = text.toLowerCase();
      const hits = list.filter(w => low.includes(w));
      return { hit: hits.length > 0, hits: hits.slice(0, 4) };
    }
  },
  {
    id: "specific",
    name: "Concrete specificity",
    note: "Numbers, time frames, or named things make a hook feel real instead of vague.",
    weight: 18,
    detect(text) {
      const hits = [];
      const nums = text.match(/\b\d+(\.\d+)?\b/g) || [];
      if (nums.length) hits.push(nums.slice(0, 3).join(", "));
      const times = text.match(/\b\d+\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/i);
      if (times) hits.push(times[0]);
      return { hit: hits.length > 0, hits };
    }
  },
  {
    id: "address",
    name: "Direct address",
    note: "Speaking to the viewer ('you', 'your') can feel personal. Overuse can feel salesy.",
    weight: 12,
    detect(text) {
      const hits = text.match(/\b(you|your|yours|yourself)\b/gi) || [];
      return { hit: hits.length > 0, hits: [hits.length + "× 'you'"] };
    }
  },
  {
    id: "payoff",
    name: "Payoff promise",
    note: "A promised payoff ('by the end', 'watch till the end') gives a reason to stay — viewers will hold you to it.",
    weight: 16,
    detect(text) {
      const list = ["by the end", "till the end", "watch till", "stay", "i'll show you", "i will show you", "in this video", "you'll learn", "you will learn"];
      const low = text.toLowerCase();
      const hits = list.filter(w => low.includes(w));
      return { hit: hits.length > 0, hits: hits.slice(0, 3) };
    }
  },
  {
    id: "length",
    name: "Tight length",
    note: "A hook is the first ~15 seconds: roughly 25–40 spoken words. Longer hooks often lose people before the payoff.",
    weight: 16,
    detect(text) {
      const words = (text.trim().match(/\S+/g) || []).length;
      const ok = words > 0 && words <= 45;
      const flag = words > 45 ? "long" : words === 0 ? "empty" : "ok";
      return { hit: flag === "ok", hits: words ? [words + " words"] : [] };
    }
  }
];

/** 0–100 score: sum of weights for hit signals. */
function scoreSignals(text) {
  return SIGNALS.reduce((s, g) => s + (g.detect(text).hit ? g.weight : 0), 0);
}

/** Verdict bucket for a score. */
function verdictFor(score) {
  if (score >= 75) return { label: "Strong signals", cls: "ok", hint: "Many classic hook signals present — still not a prediction." };
  if (score >= 45) return { label: "Some signals", cls: "warn", hint: "A few signals present. Consider tightening what is missing." };
  return { label: "Few signals", cls: "high", hint: "Few classic hook signals detected. That may be fine — signals are not quality." };
}

/** Full scan: per-signal results + score + verdict. */
function scanHook(text) {
  const results = SIGNALS.map(g => ({ ...g, result: g.detect(text) }));
  const score = results.reduce((s, g) => s + (g.result.hit ? g.weight : 0), 0);
  return { results, score, verdict: verdictFor(score) };
}

/** Build a personal note object (null when empty). */
function makeNote(title, body) {
  const t = (title || "").trim().slice(0, 120);
  const b = (body || "").trim().slice(0, 2000);
  if (!t && !b) return null;
  return { id: "n" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), title: t || "Untitled", body: b, ts: Date.now() };
}

/** Newest-first, non-mutating sort of notes. */
function sortNotes(notes) {
  return [...notes].sort((a, b) => b.ts - a.ts);
}

// ENGINE-END

/* ---------------- UI ---------------- */

const $ = id => document.getElementById(id);

// Tabs
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
    $("tab-" + tab.dataset.tab).classList.remove("hidden");
  });
});

// Signal guide (static descriptions)
$("guide").innerHTML = SIGNALS.map(g => `
  <div class="signal"><div class="top"><span class="name">${escapeHtml(g.name)}</span>
  <span class="badge ok">${g.weight} pts</span></div>
  <p>${escapeHtml(g.note)}</p></div>`).join("");

// Restore last text
chrome.storage.local.get({ lastText: "", notes: [] }, d => {
  $("text").value = d.lastText;
  renderNotes(d.notes);
});

$("run").addEventListener("click", () => {
  const text = $("text").value;
  chrome.storage.local.set({ lastText: text.slice(0, 5000) });
  if (!text.trim()) {
    $("results").classList.add("hidden");
    $("empty").classList.remove("hidden");
    $("empty").textContent = "Paste a hook first.";
    return;
  }
  const scan = scanHook(text);
  $("empty").classList.add("hidden");
  $("results").classList.remove("hidden");
  $("score").textContent = scan.score;
  const circ = 2 * Math.PI * 52;
  const fill = $("ring-fill");
  fill.style.strokeDasharray = circ;
  fill.style.strokeDashoffset = circ - (scan.score / 100) * circ;
  $("verdict").innerHTML = `${escapeHtml(scan.verdict.label)}<small>${escapeHtml(scan.verdict.hint)}</small>`;
  $("signals").innerHTML = scan.results.map(g => `
    <div class="signal">
      <div class="top"><span class="name">${escapeHtml(g.name)}</span>
      <span class="badge ${g.result.hit ? "ok" : "high"}">${g.result.hit ? "+" + g.weight + " pts" : "0 pts"}</span></div>
      <p>${escapeHtml(g.note)}</p>
      ${g.result.hits.length ? `<div class="hits">Found: ${escapeHtml(g.result.hits.join(" · "))}</div>` : ""}
    </div>`).join("");
});

$("clear").addEventListener("click", () => {
  $("text").value = "";
  chrome.storage.local.set({ lastText: "" });
  $("results").classList.add("hidden");
  $("empty").classList.remove("hidden");
  $("empty").textContent = "Paste a hook and press Scan signals.";
});

// Notes
function renderNotes(notes) {
  const list = $("note-list");
  if (!notes.length) { list.innerHTML = `<div class="note-empty">No notes yet.</div>`; return; }
  list.innerHTML = sortNotes(notes).map(n => `
    <div class="note"><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.body)}</p>
    <button class="del" data-id="${n.id}">Delete</button></div>`).join("");
  list.querySelectorAll(".del").forEach(b => b.addEventListener("click", () => {
    chrome.storage.local.get({ notes: [] }, d => {
      const rest = d.notes.filter(n => n.id !== b.dataset.id);
      chrome.storage.local.set({ notes: rest });
      renderNotes(rest);
    });
  }));
}

$("note-add").addEventListener("click", () => {
  const n = makeNote($("note-title").value, $("note-body").value);
  if (!n) return;
  chrome.storage.local.get({ notes: [] }, d => {
    const notes = [...d.notes, n].slice(-200);
    chrome.storage.local.set({ notes });
    renderNotes(notes);
    $("note-title").value = ""; $("note-body").value = "";
  });
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
