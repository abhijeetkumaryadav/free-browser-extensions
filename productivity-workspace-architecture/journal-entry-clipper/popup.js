// Journal Entry Clipper — popup UI logic.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MOODS = { great: "😊", ok: "😐", down: "😟", fired: "😤", tired: "😴" };

let selectedMood = null;
let clipSource = null; // {title, url} captured with the clip

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("clipBtn").addEventListener("click", clipFromPage);
  $("save").addEventListener("click", saveEntry);
  $("search").addEventListener("input", render);
  $("expMd").addEventListener("click", () => exportFile("md"));
  $("expJson").addEventListener("click", () => exportFile("json"));
  document.querySelectorAll("#moods button").forEach((b) =>
    b.addEventListener("click", () => {
      selectedMood = selectedMood === b.dataset.mood ? null : b.dataset.mood;
      document.querySelectorAll("#moods button").forEach((x) =>
        x.classList.toggle("sel", x.dataset.mood === selectedMood));
    })
  );
  await render();
}

// Read the current page's selection (or fall back to title/URL) and pre-fill.
async function clipFromPage() {
  const btn = $("clipBtn");
  btn.disabled = true; btn.textContent = "Clipping…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = window.getSelection ? window.getSelection().toString().trim() : "";
        return { selection: sel.slice(0, 5000), title: document.title || "" };
      },
    });
    const r = (res && res.result) || {};
    const text = r.selection || `Page: ${r.title || tab.title || ""}`;
    $("text").value = ($("text").value ? $("text").value + "\n\n" : "") + text;
    clipSource = { title: r.title || tab.title || "", url: tab.url || "" };
    $("srcTitle").textContent = clipSource.title || clipSource.url;
    $("srcLine").hidden = false;
    $("text").focus();
  } catch {
    // Page doesn't allow scripting (e.g. chrome://) — let the user type manually.
    $("text").placeholder = "Couldn't read this page — type your entry instead.";
  } finally {
    btn.disabled = false; btn.textContent = "⤓ Clip from this page";
  }
}

async function saveEntry() {
  const text = $("text").value.trim();
  if (!text) { $("text").focus(); return; }
  const tags = $("tags").value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10);
  const { entries = [] } = await chrome.storage.local.get("entries");
  entries.unshift({ id: "e-" + Date.now(), text, tags, mood: selectedMood, at: Date.now(), src: clipSource });
  await chrome.storage.local.set({ entries: entries.slice(0, 1000) });
  $("text").value = ""; $("tags").value = "";
  selectedMood = null;
  document.querySelectorAll("#moods button").forEach((x) => x.classList.remove("sel"));
  clipSource = null; $("srcLine").hidden = true;
  await render();
}

async function render() {
  const { entries = [] } = await chrome.storage.local.get("entries");
  $("entryCount").textContent = entries.length;
  const q = $("search").value.trim().toLowerCase();
  const box = $("entries");
  box.innerHTML = "";
  const shown = entries.filter((e) =>
    !q || e.text.toLowerCase().includes(q) ||
    (e.tags || []).some((t) => t.includes(q)) ||
    (e.src && (e.src.title || "").toLowerCase().includes(q))
  );
  if (!shown.length) {
    box.innerHTML = `<div class="empty">${q ? "No entries match." : "No entries yet — clip or write your first one."}</div>`;
    return;
  }
  for (const e of shown.slice(0, 200)) {
    const div = document.createElement("div");
    div.className = "entry";
    const d = new Date(e.at);
    const when = d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    div.innerHTML = `
      <div class="meta">
        ${e.mood ? `<span class="mood" title="${esc(e.mood)}">${MOODS[e.mood] || ""}</span>` : ""}
        <time>${esc(when)}</time>
        <button data-del="${e.id}" title="Delete">×</button>
      </div>
      <div class="body">${esc(e.text)}</div>
      ${(e.tags && e.tags.length) ? `<div class="tagrow">${e.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}</div>` : ""}
      ${(e.src && (e.src.title || e.src.url)) ? `<span class="from" title="${esc(e.src.url || "")}">from ${esc(e.src.title || e.src.url)}</span>` : ""}`;
    box.appendChild(div);
  }
  box.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      const { entries: cur = [] } = await chrome.storage.local.get("entries");
      await chrome.storage.local.set({ entries: cur.filter((x) => x.id !== b.dataset.del) });
      await render();
    })
  );
}

async function exportFile(kind) {
  const { entries = [] } = await chrome.storage.local.get("entries");
  if (!entries.length) return;
  let content, filename, mime;
  if (kind === "json") {
    content = JSON.stringify(entries, null, 2);
    filename = "journal-export.json"; mime = "application/json";
  } else {
    content = entries.map((e) => {
      const d = new Date(e.at).toLocaleString();
      const mood = e.mood ? ` ${MOODS[e.mood] || ""}` : "";
      const tags = (e.tags || []).map((t) => `#${t}`).join(" ");
      const src = e.src && e.src.url ? `\n> Source: [${e.src.title || e.src.url}](${e.src.url})` : "";
      return `## ${d}${mood}\n\n${e.text}\n${tags ? `\n${tags}` : ""}${src}\n`;
    }).join("\n---\n\n");
    filename = "journal-export.md"; mime = "text/markdown";
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
