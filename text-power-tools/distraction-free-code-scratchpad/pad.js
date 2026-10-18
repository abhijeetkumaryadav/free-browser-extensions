/* ScratchCode pad — multiple named scratchpads, overlay syntax highlighting.
 * Highlighting is a lightweight regex tokenizer (comments/strings/numbers/keywords),
 * intentionally NOT a full parser — labeled as such in the UI. */

const STORAGE_KEY = "codescratch.pads";
const EXT = { javascript: "js", python: "py", css: "css", plain: "txt" };

const input = document.getElementById("input");
const hlcode = document.getElementById("hlcode");
const highlight = document.getElementById("highlight");
const gutter = document.getElementById("gutter");
const padList = document.getElementById("padList");
const padName = document.getElementById("padName");
const langSelect = document.getElementById("langSelect");
const lineInfo = document.getElementById("lineInfo");
const saveState = document.getElementById("saveState");

let pads = [];
let activeId = null;
let saveTimer = null;

/* ------------------------- lightweight highlighter ------------------------ */

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Each language: one combined regex; capture-group order maps to token classes.
const LANGS = {
  javascript: {
    pattern: /(\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*)|(`(?:[^`\\]|\\.)*(?:`|$)|'(?:[^'\\\n]|\\.)*(?:'|$)|"(?:[^"\\\n]|\\.)*(?:"|$))|\b(\d[\d_]*(?:\.\d+)?)\b|\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|new|this|typeof|instanceof|in|of|import|from|export|default|async|await|try|catch|finally|throw|null|undefined|true|false|void|delete)\b/g,
    classes: ["comment", "string", "number", "keyword"],
  },
  python: {
    pattern: /(#[^\n]*)|('''[\s\S]*?(?:'''|$)|"""[\s\S]*?(?:"""|$)|\'(?:[^\'\\\n]|\\.)*(?:\'|$)|"(?:[^"\\\n]|\\.)*(?:"|$))|\b(\d[\d_]*(?:\.\d+)?)\b|\b(def|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|import|from|as|class|with|try|except|finally|raise|lambda|pass|yield|global|assert|del|print)\b/g,
    classes: ["comment", "string", "number", "keyword"],
  },
  css: {
    pattern: /(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*(?:"|$)|'(?:[^'\\\n]|\\.)*(?:'|$))|\b(\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)?)|\b(#[0-9a-fA-F]{3,8})|(@[a-z-]+)|\b([a-z-]+)(?=\s*:)/g,
    classes: ["comment", "string", "number", "number", "atrule", "property"],
  },
};

function highlightCode(code, lang) {
  const rule = LANGS[lang];
  if (!rule) return escapeHtml(code);
  rule.pattern.lastIndex = 0;
  return code.replace(rule.pattern, (...args) => {
    const match = args[0];
    const groups = args.slice(1, -2); // drop offset + full string
    const idx = groups.findIndex((g) => g !== undefined);
    const cls = rule.classes[idx] || "keyword";
    return `<span class="tok-${cls}">${escapeHtml(match)}</span>`;
  });
}

/* --------------------------------- rendering ------------------------------- */

function render() {
  const pad = activePad();
  if (!pad) return;
  // Highlighted layer (behind the transparent textarea).
  hlcode.innerHTML = highlightCode(input.value, pad.lang) + "\n";
  // Line numbers.
  const n = input.value.split("\n").length;
  let g = "";
  for (let i = 1; i <= n; i++) g += `<div>${i}</div>`;
  gutter.innerHTML = g;
  lineInfo.textContent = `${n} line${n === 1 ? "" : "s"} · ${input.value.length} chars`;
  syncScroll();
}

function syncScroll() {
  highlight.scrollTop = input.scrollTop;
  highlight.scrollLeft = input.scrollLeft;
  gutter.scrollTop = input.scrollTop;
}

/* --------------------------------- storage --------------------------------- */

async function loadPads() {
  const { [STORAGE_KEY]: stored = [] } = await chrome.storage.local.get(STORAGE_KEY);
  pads = stored;
  if (!pads.length) {
    pads = [makePad("Untitled 1")];
    await persist();
  }
  activeId = pads[0].id;
}

function makePad(name) {
  return {
    id: "pad-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name,
    lang: "javascript",
    code: "",
    updatedAt: Date.now(),
  };
}

async function persist() {
  await chrome.storage.local.set({ [STORAGE_KEY]: pads });
}

function activePad() {
  return pads.find((p) => p.id === activeId) || null;
}

function scheduleSave() {
  const pad = activePad();
  if (!pad) return;
  pad.code = input.value;
  pad.updatedAt = Date.now();
  saveState.textContent = "Saving…";
  saveState.classList.add("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await persist();
    renderPadList();
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    saveState.textContent = "Saved " + t;
    saveState.classList.remove("saving");
  }, 700);
}

function switchPad(id) {
  const cur = activePad();
  if (cur) cur.code = input.value; // keep unsaved text
  activeId = id;
  const pad = activePad();
  input.value = pad.code || "";
  padName.value = pad.name;
  langSelect.value = pad.lang;
  render();
  renderPadList();
  saveState.textContent = "Saved";
  saveState.classList.remove("saving");
}

function renderPadList() {
  padList.innerHTML = "";
  pads.forEach((p) => {
    const div = document.createElement("div");
    div.className = "pad-item" + (p.id === activeId ? " active" : "");
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = p.name;
    const m = document.createElement("div");
    m.className = "m";
    m.textContent = `${EXT[p.lang] || "txt"} · ${new Date(p.updatedAt).toLocaleDateString()}`;
    div.append(t, m);
    div.addEventListener("click", () => switchPad(p.id));
    padList.appendChild(div);
  });
}

/* ---------------------------------- events --------------------------------- */

input.addEventListener("input", () => {
  render();
  scheduleSave();
});
input.addEventListener("scroll", syncScroll);

// Tab inserts two spaces instead of leaving the field.
input.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const s = input.selectionStart;
    input.setRangeText("  ", s, input.selectionEnd, "end");
    render();
    scheduleSave();
  }
});

padName.addEventListener("input", () => {
  const pad = activePad();
  if (!pad) return;
  pad.name = padName.value.trim() || "Untitled";
  scheduleSave();
  renderPadList();
});

langSelect.addEventListener("change", () => {
  const pad = activePad();
  if (!pad) return;
  pad.lang = langSelect.value;
  render();
  scheduleSave();
});

document.getElementById("newPad").addEventListener("click", async () => {
  const cur = activePad();
  if (cur) cur.code = input.value;
  const pad = makePad("Untitled " + (pads.length + 1));
  pads.unshift(pad);
  await persist();
  switchPad(pad.id);
  input.focus();
});

document.getElementById("renameBtn").addEventListener("click", () => {
  padName.focus();
  padName.select();
});

document.getElementById("deleteBtn").addEventListener("click", async () => {
  const pad = activePad();
  if (!pad) return;
  if (pads.length === 1) {
    alert("You need at least one scratchpad.");
    return;
  }
  if (!confirm(`Delete "${pad.name}"?`)) return;
  pads = pads.filter((p) => p.id !== pad.id);
  await persist();
  activeId = pads[0].id;
  const next = activePad();
  input.value = next.code || "";
  padName.value = next.name;
  langSelect.value = next.lang;
  render();
  renderPadList();
});

document.getElementById("downloadBtn").addEventListener("click", () => {
  const pad = activePad();
  if (!pad) return;
  const ext = EXT[pad.lang] || "txt";
  const safe = pad.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "scratchpad";
  const blob = new Blob([input.value], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safe}.${ext}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
});

window.addEventListener("resize", syncScroll);

/* ----------------------------------- init ----------------------------------- */

(async function init() {
  await loadPads();
  const pad = activePad();
  input.value = pad.code || "";
  padName.value = pad.name;
  langSelect.value = pad.lang;
  render();
  renderPadList();
})();
