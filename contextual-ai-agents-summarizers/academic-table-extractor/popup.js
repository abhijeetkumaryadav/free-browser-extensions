// Academic Table Extractor — popup logic.
// scanTables() and getTableData() are injected into the page; keep them self-contained.

function scanTables() {
  const tables = Array.from(document.querySelectorAll("table")).slice(0, 60);
  const out = [];
  tables.forEach((t, i) => {
    const rows = Array.from(t.rows);
    if (!rows.length) return;
    const cols = rows.reduce((m, r) => Math.max(m, r.cells.length), 0);
    if (!cols) return;
    let caption = "";
    const cap = t.querySelector("caption");
    if (cap) caption = cap.innerText.trim().replace(/\s+/g, " ").slice(0, 90);
    if (!caption) {
      const prev = t.previousElementSibling;
      if (prev && /^(H[1-6]|P|FIGCAPTION)$/.test(prev.tagName) && prev.innerText.trim().length < 100) {
        caption = prev.innerText.trim().replace(/\s+/g, " ");
      }
    }
    const preview = rows.slice(0, 3).map((r) =>
      Array.from(r.cells).slice(0, 5).map((c) =>
        (c.innerText || "").trim().replace(/\s+/g, " ").slice(0, 40)
      )
    );
    out.push({ index: i, rows: rows.length, cols, caption: caption || ("Table " + (i + 1)), preview });
  });
  return out;
}

function getTableData(index) {
  const t = document.querySelectorAll("table")[index];
  if (!t) return null;
  return Array.from(t.rows).slice(0, 2000).map((r) =>
    Array.from(r.cells).slice(0, 60).map((c) =>
      (c.innerText || "").trim().replace(/\s+/g, " ")
    )
  );
}

const $ = (id) => document.getElementById(id);
let found = [];
let selected = -1;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", scan);
  $("exportBtn").addEventListener("click", exportCsv);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  scan();
}

async function runInPage(func, args) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("no-tab");
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  return res && res.result;
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  $("tables").innerHTML = "";
  $("exportBar").hidden = true;
  selected = -1;
  try {
    found = (await runInPage(scanTables)) || [];
    if (!found.length) {
      $("status").textContent = "No HTML tables found on this page.";
    } else {
      $("status").textContent = `${found.length} table${found.length > 1 ? "s" : ""} found — click one to export.`;
      renderList();
    }
  } catch (e) {
    $("status").textContent = "Couldn’t scan this page (try a regular web page, not a store or PDF viewer).";
  } finally {
    btn.disabled = false; btn.textContent = "Rescan";
  }
}

function renderList() {
  const box = $("tables");
  box.innerHTML = "";
  for (const t of found) {
    const card = document.createElement("div");
    card.className = "tcard glass" + (t.index === selected ? " selected" : "");
    const head = document.createElement("div");
    head.className = "thead";
    const b = document.createElement("b");
    b.textContent = t.caption; b.title = t.caption;
    const dims = document.createElement("span");
    dims.className = "dims";
    dims.textContent = `${t.rows} × ${t.cols}`;
    head.append(b, dims);
    const prev = document.createElement("div");
    prev.className = "preview";
    t.preview.forEach((row, ri) => {
      const d = document.createElement("div");
      d.className = "prow" + (ri === 0 ? " head" : "");
      row.forEach((cell) => {
        const s = document.createElement("span");
        s.textContent = cell || "·";
        d.appendChild(s);
      });
      prev.appendChild(d);
    });
    card.append(head, prev);
    card.addEventListener("click", () => {
      selected = t.index;
      document.querySelectorAll(".tcard").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      $("exportBar").hidden = false;
      $("selName").textContent = t.caption;
      $("selDims").textContent = `${t.rows} rows × ${t.cols} columns`;
    });
    box.appendChild(card);
  }
}

function toCsv(rows) {
  const esc = (v) => {
    v = String(v == null ? "" : v);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

async function exportCsv() {
  const btn = $("exportBtn");
  if (selected < 0) return;
  btn.disabled = true; btn.textContent = "Exporting…";
  try {
    const data = await runInPage(getTableData, [selected]);
    if (!data || !data.length) throw new Error("no-data");
    const t = found.find((x) => x.index === selected);
    const name = ((t && t.caption) || "table")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "table";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + toCsv(data)], { type: "text/csv;charset=utf-8" }));
    a.download = `${name}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    btn.textContent = "Exported ✓";
  } catch (e) {
    btn.textContent = "Export failed";
  } finally {
    setTimeout(() => { btn.disabled = false; btn.textContent = "Export CSV"; }, 1200);
  }
}
