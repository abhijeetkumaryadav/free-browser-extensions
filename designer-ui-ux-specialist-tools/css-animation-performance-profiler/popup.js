// ============================================================================
// popup.js — runs the read-only page scan via scripting.executeScript and
// renders the keyframes / animations / transitions report.
// ============================================================================
const $ = id => document.getElementById(id);

const SEV_LABEL = { good: "Smooth", warn: "Paint-heavy", bad: "Expensive" };
const CARD_CLASS = { good: "", warn: "warn", bad: "bad" };

$("scanBtn").addEventListener("click", async () => {
  const btn = $("scanBtn");
  btn.disabled = true;
  btn.style.opacity = "0.6";
  $("hint").textContent = "Scanning…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome|^edge|^about|^moz-extension/.test(tab.url || "")) {
      $("hint").textContent = "Cannot scan browser-internal pages. Try a regular website.";
      return;
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scan.js"]
    });
    render(result);
    $("hint").textContent = "Read-only scan — nothing on the page was modified.";
  } catch (e) {
    $("hint").textContent = "Scan failed: " + (e.message || e);
  } finally {
    btn.disabled = false;
    btn.style.opacity = "1";
  }
});

function render(data) {
  const { keyframes, animations, transitions } = data;
  $("statKeyframes").textContent = keyframes.length;
  $("statAnimations").textContent = animations.length;
  $("statTransitions").textContent = transitions.length;
  const expensive = [...keyframes, ...animations, ...transitions].filter(x => x.severity === "bad").length;
  $("statExpensive").textContent = expensive;

  const list = $("animList");
  list.innerHTML = "";
  $("results").classList.remove("hidden");

  const all = [
    ...keyframes.map(k => ({ kind: "@keyframes", title: k.name, ...k })),
    ...animations.map(a => ({ kind: "animation", title: a.names.join(", "), ...a })),
    ...transitions.map(t => ({ kind: "transition", title: t.props.join(", "), ...t }))
  ];
  // Expensive first
  const rank = { bad: 0, warn: 1, good: 2 };
  all.sort((x, y) => rank[x.severity] - rank[y.severity]);

  if (!all.length) { $("emptyState").classList.remove("hidden"); return; }
  $("emptyState").classList.add("hidden");

  for (const item of all) {
    const card = document.createElement("div");
    card.className = "anim-card " + CARD_CLASS[item.severity];

    const propChips = item.props.slice(0, 12).map(p => {
      const cls = classifyClient(p);
      return `<span class="prop ${cls}">${escapeHtml(p)}</span>`;
    }).join("");

    card.innerHTML = `
      <div class="anim-top">
        <span class="anim-name">${escapeHtml(item.title || "(unnamed)")}</span>
        <span class="badge ${item.severity}">${SEV_LABEL[item.severity]}</span>
      </div>
      <div class="anim-meta">${escapeHtml(item.kind)}${item.selector ? " · " + escapeHtml(item.selector) : ""}${item.duration ? " · " + escapeHtml(item.duration) : ""}</div>
      <div class="props">${propChips || '<span class="prop">no properties detected</span>'}</div>
      <div class="tip"><strong>Tip:</strong> ${escapeHtml(item.tip)}</div>`;
    list.appendChild(card);
  }
}

// Lightweight client-side classifier mirroring scan.js for chip coloring
function classifyClient(prop) {
  const p = prop.toLowerCase().trim();
  if (["transform", "opacity", "rotate", "scale", "translate", "filter"].includes(p)) return "cheap";
  if (/^(width|height|min-|max-|top|left|right|bottom|margin|padding|inset|font-size|line-height|flex|grid|position|display|float)/.test(p)) return "expensive";
  return "paint";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
