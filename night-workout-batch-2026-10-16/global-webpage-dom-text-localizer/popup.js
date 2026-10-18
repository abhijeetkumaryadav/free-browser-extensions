// Popup logic for Localize This Page.
// Manages the user's find→replace pairs (chrome.storage.local) and injects
// localizer.js into the active tab only when the user clicks Apply / Restore.

const STORAGE_KEY = "loc_pairs_v1";

const findInput = document.getElementById("findInput");
const replaceInput = document.getElementById("replaceInput");
const pairList = document.getElementById("pairList");
const emptyMsg = document.getElementById("emptyMsg");
const statusEl = document.getElementById("status");

/** Load pairs from storage; always returns an array. */
async function loadPairs() {
  const { [STORAGE_KEY]: pairs } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(pairs) ? pairs : [];
}

async function savePairs(pairs) {
  await chrome.storage.local.set({ [STORAGE_KEY]: pairs });
}

/** Render the pair list. */
function renderPairs(pairs) {
  pairList.innerHTML = "";
  emptyMsg.style.display = pairs.length ? "none" : "block";
  pairs.forEach((p, i) => {
    const li = document.createElement("li");

    const findSpan = document.createElement("span");
    findSpan.className = "find";
    findSpan.textContent = p.find;

    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = "→";

    const replSpan = document.createElement("span");
    replSpan.className = "repl";
    replSpan.textContent = p.replace;

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.title = "Delete pair";
    del.addEventListener("click", async () => {
      const current = await loadPairs();
      current.splice(i, 1);
      await savePairs(current);
      renderPairs(current);
    });

    li.append(findSpan, arrow, replSpan, del);
    pairList.appendChild(li);
  });
}

function setStatus(msg, kind = "") {
  statusEl.textContent = msg;
  statusEl.className = "status " + kind;
}

/** Get the active tab; guard internal pages where scripting is not allowed. */
async function getUsableTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !tab.url) { setStatus("No usable tab found.", "err"); return null; }
  if (!/^https?:/.test(tab.url) && !/^file:/.test(tab.url)) {
    setStatus("This page type can't be modified (internal pages).", "err");
    return null;
  }
  return tab;
}

// Applies pairs via an injected function (see runLocalizer below).
async function runLocalizer(tabId, arg) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "ISOLATED",
    func: async (payload) => {
      const MARK = "data-loc-original";
      function collectTextNodes(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            const el = node.parentElement;
            if (!el) return NodeFilter.FILTER_REJECT;
            const tag = el.tagName;
            if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEXTAREA") return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });
        const nodes = [];
        let n;
        while ((n = walker.nextNode())) nodes.push(n);
        return nodes;
      }
      if (payload.action === "apply") {
        const sorted = [...(payload.pairs || [])]
          .filter(p => p.find && p.find.length)
          .sort((a, b) => b.find.length - a.find.length);
        if (!sorted.length) return { replaced: 0 };
        let count = 0;
        for (const node of collectTextNodes(document.body)) {
          const parent = node.parentElement;
          if (parent && parent.hasAttribute(MARK)) continue;
          let text = node.nodeValue, changed = false;
          for (const p of sorted) {
            if (text.includes(p.find)) { text = text.split(p.find).join(p.replace ?? ""); changed = true; }
          }
          if (changed) {
            const stash = parent.getAttribute(MARK);
            const data = stash ? JSON.parse(stash) : {};
            const idx = Array.prototype.indexOf.call(parent.childNodes, node);
            data[idx] = node.nodeValue;
            parent.setAttribute(MARK, JSON.stringify(data));
            node.nodeValue = text;
            count++;
          }
        }
        return { replaced: count };
      }
      if (payload.action === "restore") {
        let count = 0;
        for (const el of document.querySelectorAll("[data-loc-original]")) {
          try {
            const data = JSON.parse(el.getAttribute("data-loc-original"));
            for (const [idx, original] of Object.entries(data)) {
              const node = el.childNodes[Number(idx)];
              if (node && node.nodeType === Node.TEXT_NODE) { node.nodeValue = original; count++; }
            }
          } catch (e) {}
          el.removeAttribute("data-loc-original");
        }
        return { restored: count };
      }
      return { ok: false };
    },
    args: [arg]
  });
  return result;
}

document.getElementById("addPair").addEventListener("click", async () => {
  const find = findInput.value.trim();
  const replace = replaceInput.value; // replace may legitimately be empty
  if (!find) { findInput.focus(); return; }
  const pairs = await loadPairs();
  if (pairs.some(p => p.find === find)) { setStatus("That pair already exists.", "err"); return; }
  pairs.push({ find, replace });
  await savePairs(pairs);
  renderPairs(pairs);
  findInput.value = "";
  replaceInput.value = "";
  findInput.focus();
  setStatus("");
});

[findInput, replaceInput].forEach(el =>
  el.addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("addPair").click();
  })
);

document.getElementById("clearAll").addEventListener("click", async () => {
  await savePairs([]);
  renderPairs([]);
  setStatus("All pairs cleared.");
});

document.getElementById("applyBtn").addEventListener("click", async () => {
  const pairs = await loadPairs();
  if (!pairs.length) { setStatus("Add at least one translation pair first.", "err"); return; }
  const tab = await getUsableTab();
  if (!tab) return;
  setStatus("Applying…");
  try {
    const result = await runLocalizer(tab.id, { action: "apply", pairs });
    const n = result && result.replaced ? result.replaced : 0;
    setStatus(`Applied ${pairs.length} pair(s) — ${n} text node(s) replaced.`, "ok");
  } catch (e) {
    setStatus("Could not run on this page: " + e.message, "err");
  }
});

document.getElementById("restoreBtn").addEventListener("click", async () => {
  const tab = await getUsableTab();
  if (!tab) return;
  setStatus("Restoring…");
  try {
    const result = await runLocalizer(tab.id, { action: "restore" });
    const n = result && result.restored ? result.restored : 0;
    setStatus(`Restored ${n} text node(s) to original.`, "ok");
  } catch (e) {
    setStatus("Could not run on this page: " + e.message, "err");
  }
});

loadPairs().then(renderPairs);
