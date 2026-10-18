/* =====================================================================
 * Prompt Style Analyzer — pure heuristic engine (no AI, no network).
 * Describes SURFACE patterns in a pasted prompt: instruction density,
 * role framing, listed constraints, structure. It cannot decode intent
 * or reverse-engineer a real system prompt — the UI says so loudly.
 * =================================================================== */

// ENGINE-START

const IMPERATIVE_VERBS = [
  "write", "generate", "create", "summarize", "summarise", "explain",
  "list", "describe", "compare", "analyze", "analyse", "translate",
  "classify", "extract", "rewrite", "draft", "outline", "define",
  "identify", "predict", "evaluate", "revise", "convert", "transform",
  "complete", "answer", "solve", "design", "build", "produce", "return",
  "provide", "give", "ensure", "avoid", "do not", "don't", "never",
  "always", "must", "should", "use", "follow", "format", "limit",
  "respond", "act", "think", "consider", "break", "organize", "organise",
];

const ROLE_PATTERNS = [
  /\byou are (an?|the)\b/i,
  /\bact as (an?|the)\b/i,
  /\byour role is\b/i,
  /\bpersona\b/i,
];

const STRUCTURE_PATTERNS = [
  { name: "Numbered constraints", re: /(?:^|\n)\s*\d+[.)]\s+\S/gm, desc: "Found a numbered list — often a list of constraints or steps." },
  { name: "Bulleted list", re: /(?:^|\n)\s*[-*•]\s+\S/gm, desc: "Found a bulleted list — a sign of explicit structure." },
  { name: "Quoted examples", re: /(["“])(?:(?!\1).){3,}?\1/g, desc: "Found quoted text — often examples or exact phrasing to follow." },
  { name: "Code blocks", re: /```[\s\S]*?```/, desc: "Found a code block — likely a format template or example." },
  { name: "Delimiter sections", re: /(?:^|\n)\s*#{1,4}\s+\S/gm, desc: "Found markdown headers — a sectioned prompt." },
];

/** Tokenize to lowercase words. */
function tokenize(text) {
  const m = (text || "").toLowerCase().match(/[a-z0-9']+/g);
  return m || [];
}

/**
 * Analyze a prompt's surface style.
 * @returns null for empty input, else:
 * { words, imperatives, imperativeDensity, hasRole, roleMatch,
 *   constraints, structureFlags: [{name, desc, hits}],
 *   structScore (0-100), styleLabel }
 */
function analyzePrompt(text) {
  const raw = (text || "").trim();
  if (!raw) return null;
  const tokens = tokenize(raw);

  // Instruction density: imperative verb (or phrase) hits per 100 words.
  let impHits = 0;
  const low = " " + raw.toLowerCase().replace(/\s+/g, " ") + " ";
  for (const v of IMPERATIVE_VERBS) {
    const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const m = low.match(re);
    if (m) impHits += m.length;
  }
  const density = tokens.length ? (impHits / tokens.length) * 100 : 0;

  // Role framing.
  let roleMatch = null;
  for (const re of ROLE_PATTERNS) {
    const m = raw.match(re);
    if (m) { roleMatch = m[0]; break; }
  }

  // Structure flags.
  const structureFlags = [];
  let totalHits = 0;
  for (const sp of STRUCTURE_PATTERNS) {
    const m = raw.match(sp.re);
    if (m) {
      structureFlags.push({ name: sp.name, desc: sp.desc, hits: m.length });
      totalHits += m.length;
    }
  }

  // Constraints: numbered/bulleted list items + explicit "must/never/avoid" rules.
  const constraintItems = totalHits;
  const structScore = Math.min(100, Math.round(constraintItems * 12 + (roleMatch ? 15 : 0) + Math.min(30, density * 3)));

  let styleLabel;
  if (structScore >= 70) styleLabel = "Highly structured";
  else if (structScore >= 40) styleLabel = "Moderately structured";
  else if (structScore >= 15) styleLabel = "Lightly structured";
  else styleLabel = "Loose / conversational";

  return {
    words: tokens.length,
    imperatives: impHits,
    imperativeDensity: Math.round(density * 10) / 10,
    hasRole: !!roleMatch,
    roleMatch,
    constraints: constraintItems,
    structureFlags,
    structScore,
    styleLabel,
  };
}

// ENGINE-END

/* ------------------------------ UI wiring ----------------------------- */

const $ = (id) => document.getElementById(id);

function escHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function setRing(score) {
  const ring = $("scoreRing");
  const deg = Math.round((score / 100) * 360);
  ring.style.background = `conic-gradient(var(--accent) ${deg}deg, #2a2a33 ${deg}deg)`;
  $("scorePct").textContent = score;
}

function render() {
  const text = $("promptInput").value.trim();
  const a = analyzePrompt(text);
  const box = $("results");
  if (!a) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  setRing(a.structScore);
  $("styleVerdict").textContent = a.styleLabel;
  $("styleDetail").textContent =
    `${a.imperativeDensity}% instruction-word density. ` +
    `This describes patterns only — not what the prompt "really does".`;
  $("statWords").textContent = a.words;
  $("statImper").textContent = a.imperatives;
  $("statConstr").textContent = a.constraints;

  const flags = [];
  flags.push({
    name: a.hasRole ? `Role framing: "${a.roleMatch}"` : "No role framing detected",
    desc: a.hasRole
      ? "The prompt assigns a role or persona. A common technique for steering tone."
      : "No \"you are a…\" / \"act as…\" pattern found. It may rely on plain instructions instead.",
    hit: a.hasRole,
  });
  for (const f of a.structureFlags) {
    flags.push({
      name: `${f.name} × ${f.hits}`,
      desc: f.desc,
      hit: true,
    });
  }
  flags.push({
    name: `Instruction density: ${a.imperativeDensity}%`,
    desc: a.imperativeDensity >= 8
      ? "Dense with instruction words — a command-heavy prompt."
      : "Relatively few instruction words — may be more conversational than commanding.",
    hit: a.imperativeDensity >= 8,
  });
  $("flags").innerHTML = flags.map((f) => `
    <div class="flag${f.hit ? "" : " miss"}">
      <div class="flag-name">${escHtml(f.name)}</div>
      <div class="flag-desc">${escHtml(f.desc)}</div>
    </div>`).join("");
}

$("analyzeBtn").addEventListener("click", () => {
  render();
  chrome.storage.local.set({ promptText: $("promptInput").value, promptNotes: $("notesInput").value });
});
$("clearBtn").addEventListener("click", () => {
  $("promptInput").value = "";
  $("results").classList.add("hidden");
  chrome.storage.local.remove(["promptText"]);
});

let notesTimer = null;
$("notesInput").addEventListener("input", () => {
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    chrome.storage.local.set({ promptNotes: $("notesInput").value });
  }, 400);
});

chrome.storage.local.get(["promptText", "promptNotes"], (d) => {
  if (d.promptText) $("promptInput").value = d.promptText;
  if (d.promptNotes) $("notesInput").value = d.promptNotes;
});
