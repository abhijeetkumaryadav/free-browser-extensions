/* Style Lint — popup logic + bundled heuristic rule engine.
   Rule-based pattern matching only. This is NOT an AI grammar engine:
   it flags surface patterns and explains each one so the writer decides. */

// ---- Bundled rule set -------------------------------------------------
// Each rule: { id, label, why, test(text) -> array of matched substrings }
const RULES = [
  {
    id: "double-spaces",
    label: "Double spaces",
    why: "Two or more spaces in a row usually sneak in from edits. One space is the convention.",
    test: (t) => (t.match(/ {2,}/g) || []).map(m => `“${m}” (${m.length} spaces)`)
  },
  {
    id: "repeated-words",
    label: "Repeated words",
    why: "The same word twice in a row (\"the the\") is almost always a typo.",
    test: (t) => {
      const out = [];
      const re = /\b([A-Za-z']+)\s+\1\b/gi;
      let m; while ((m = re.exec(t))) out.push(`“${m[0]}”`);
      return out;
    }
  },
  {
    id: "homophones",
    label: "Common homophone slips",
    why: "their/there/they're, your/you're, its/it's, to/too/two are easy to mix up — double-check each use in context.",
    test: (t) => {
      const sets = [
        ["their", "there", "they're"], ["your", "you're"],
        ["its", "it's"], ["to", "too", "two"],
        ["then", "than"], ["affect", "effect"],
        ["principal", "principle"], ["compliment", "complement"]
      ];
      const out = [];
      for (const s of sets) {
        const re = new RegExp(`\\b(${s.join("|")})\\b`, "gi");
        let m; while ((m = re.exec(t))) out.push(`“${m[0]}” (check: ${s.join(" / ")})`);
      }
      return out;
    }
  },
  {
    id: "passive-ish",
    label: "Passive-voice patterns",
    why: "“was written”, “is being done” style phrasing can hide the actor. Active voice is often clearer — but passive is fine when the actor doesn't matter.",
    test: (t) => {
      const out = [];
      const re = /\b(am|is|are|was|were|be|been|being)\s+(\w+ed|done|made|taken|given|shown|known)\b/gi;
      let m; while ((m = re.exec(t))) out.push(`“${m[0]}”`);
      return out;
    }
  },
  {
    id: "weasel-words",
    label: "Weasel / filler words",
    why: "very, really, just, actually, basically, literally, stuff, things weaken claims. Cut them unless they carry meaning.",
    test: (t) => {
      const words = ["very","really","just","actually","basically","literally","stuff","things","quite","rather"];
      const out = [];
      const re = new RegExp(`\\b(${words.join("|")})\\b`, "gi");
      let m; while ((m = re.exec(t))) out.push(`“${m[0]}”`);
      return out;
    }
  },
  {
    id: "long-sentence",
    label: "Very long sentences",
    why: "Sentences over ~35 words are harder to follow. Consider splitting them.",
    test: (t) => {
      const out = [];
      for (const s of t.split(/(?<=[.!?])\s+/)) {
        const n = s.trim().split(/\s+/).filter(Boolean).length;
        if (n > 35) out.push(`${n} words: “${s.slice(0, 70)}…”`);
      }
      return out;
    }
  }
];

// ---- Rendering ----------------------------------------------------------
const $ = (id) => document.getElementById(id);

function renderRuleList() {
  $("ruleList").innerHTML = RULES.map(r => `<li><b>${r.label}:</b> ${r.why}</li>`).join("");
}

function runChecks() {
  const text = $("text").value;
  const flagsEl = $("flags");
  const summary = $("summary");
  flagsEl.innerHTML = "";
  if (!text.trim()) {
    summary.classList.remove("hidden", "clean");
    summary.textContent = "Paste some text (or grab the active input) first.";
    return;
  }
  let total = 0;
  for (const rule of RULES) {
    const hits = rule.test(text).slice(0, 8); // cap per rule
    for (const h of hits) {
      total++;
      const li = document.createElement("li");
      li.innerHTML = `<span class="tag">${rule.label}</span><span class="match"></span><span class="why">${rule.why}</span>`;
      li.querySelector(".match").textContent = h;
      flagsEl.appendChild(li);
    }
  }
  summary.classList.remove("hidden");
  if (total === 0) {
    summary.classList.add("clean");
    summary.textContent = "No pattern flags found. Heuristic only — a clean pass doesn't mean perfect prose.";
  } else {
    summary.classList.remove("clean");
    summary.textContent = `${total} flag${total === 1 ? "" : "s"} found. Review each one — flags are suggestions, not corrections.`;
  }
  chrome.storage.local.set({ lastCheck: { at: Date.now(), flags: total } }).catch(() => {});
}

// Grab text from the focused input/textarea/contenteditable on the active tab.
async function grabActiveInput() {
  const btn = $("activeBtn");
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
      alert("Open a normal web page first — the active tab can't be read here.");
      return;
    }
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    // content.js returns the active element's text via the last evaluated value.
    const val = res && res.result;
    if (typeof val === "string" && val.trim()) {
      $("text").value = val.slice(0, 20000);
      runChecks();
    } else {
      alert("No focused text field found. Click into a text box on the page, then try again.");
    }
  } catch (e) {
    alert("Couldn't read the active input: " + (e.message || e));
  } finally {
    btn.disabled = false;
  }
}

$("checkBtn").addEventListener("click", runChecks);
$("activeBtn").addEventListener("click", grabActiveInput);
renderRuleList();
