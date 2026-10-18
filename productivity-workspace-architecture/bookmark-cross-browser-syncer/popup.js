// Bookmark Cross-Browser Syncer — popup logic. All local, `bookmarks` permission only.

const $ = (id) => document.getElementById(id);
const MAX_IMPORT = 5000; // sanity cap per import

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("expJson").addEventListener("click", exportJson);
  $("expHtml").addEventListener("click", exportHtml);
  $("importBtn").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", importFile);
  await renderStats();
}

/* ---------- stats ---------- */

function walk(nodes, depth, acc, isRoot) {
  for (const n of nodes) {
    if (n.url) {
      acc.bookmarks++;
      acc.depthMax = Math.max(acc.depthMax, depth);
    } else {
      if (!isRoot) {
        acc.folders++;
        if (!(n.children && n.children.length)) acc.empty.push(n.title || "Untitled folder");
      }
      walk(n.children || [], depth + 1, acc, false);
    }
  }
}

async function renderStats() {
  try {
    const tree = await chrome.bookmarks.getTree();
    const acc = { bookmarks: 0, folders: 0, empty: [], depthMax: 0 };
    walk(tree, 0, acc, true);
    $("stCount").textContent = acc.bookmarks.toLocaleString();
    $("stFolders").textContent = acc.folders.toLocaleString();
    $("stEmpty").textContent = acc.empty.length.toLocaleString();
    if (acc.empty.length) {
      const box = $("emptyList");
      box.hidden = false;
      const b = document.createElement("b");
      b.textContent = "Empty folders — safe to tidy up:";
      box.append(b, document.createTextNode(acc.empty.slice(0, 6).join(" · ") + (acc.empty.length > 6 ? " · …" : "")));
    }
  } catch (e) {
    $("stCount").textContent = "—";
  }
}

/* ---------- export ---------- */

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function download(filename, text, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function exportJson() {
  const tree = await chrome.bookmarks.getTree();
  download(
    `bookmarks-backup-${stamp()}.json`,
    JSON.stringify({ app: "bookmark-cross-browser-syncer", version: 1, exportedAt: new Date().toISOString(), tree }, null, 2),
    "application/json"
  );
}

function netscapeDL(nodes, indent) {
  let out = `${indent}<DL><p>\n`;
  for (const n of nodes) {
    if (n.url) {
      out += `${indent}    <DT><A HREF="${esc(n.url)}">${esc(n.title || n.url)}</A>\n`;
    } else if (n.children) {
      out += `${indent}    <DT><H3>${esc(n.title || "Folder")}</H3>\n`;
      out += netscapeDL(n.children, indent + "    ");
    }
  }
  return out + `${indent}</DL><p>\n`;
}

async function exportHtml() {
  const tree = await chrome.bookmarks.getTree();
  const roots = [];
  for (const r of tree) for (const c of (r.children || [])) roots.push(c);
  const html =
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n" +
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
    "<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n" +
    netscapeDL(roots, "");
  download(`bookmarks-${stamp()}.html`, html, "text/html");
}

/* ---------- import ---------- */

function parseDL(dl) {
  const nodes = [];
  for (const el of dl.children) {
    if (el.tagName !== "DT") continue;
    const kids = Array.from(el.children);
    const h3 = kids.find((c) => c.tagName === "H3");
    const a = kids.find((c) => c.tagName === "A");
    if (h3) {
      const sub = el.querySelector(":scope > DL") || nextDL(el);
      nodes.push({ title: (h3.textContent || "Folder").trim(), children: sub ? parseDL(sub) : [] });
    } else if (a) {
      const url = a.getAttribute("href") || "";
      if (url) nodes.push({ title: (a.textContent || url).trim(), url });
    }
  }
  return nodes;
}

function nextDL(el) {
  let s = el.nextElementSibling;
  while (s) { if (s.tagName === "DL") return s; s = s.nextElementSibling; }
  return null;
}

function parseNetscape(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const dl = doc.querySelector("DL");
  if (!dl) throw new Error("no-bookmarks");
  return parseDL(dl);
}

function normalizeJson(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.tree)) {
    const out = [];
    for (const root of data.tree) for (const c of (root.children || [])) out.push(c);
    return out;
  }
  throw new Error("unrecognized-json");
}

async function collectUrls() {
  const tree = await chrome.bookmarks.getTree();
  const set = new Set();
  (function rec(nodes) {
    for (const n of nodes) {
      if (n.url) set.add(n.url.trim().toLowerCase());
      if (n.children) rec(n.children);
    }
  })(tree);
  return set;
}

async function importNodes(parentId, nodes, urlSet, report) {
  for (const n of nodes) {
    if (report.imported + report.skipped >= MAX_IMPORT) break;
    if (n.url) {
      const key = n.url.trim().toLowerCase();
      if (urlSet.has(key)) { report.skipped++; continue; }
      try {
        await chrome.bookmarks.create({ parentId, title: n.title || n.url, url: n.url });
        urlSet.add(key);
        report.imported++;
      } catch (e) { report.skipped++; }
    } else if (n.children) {
      try {
        const f = await chrome.bookmarks.create({ parentId, title: n.title || "Folder" });
        await importNodes(f.id, n.children, urlSet, report);
      } catch (e) { /* skip bad subtree */ }
    }
  }
}

async function importFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const box = $("report");
  box.hidden = false;
  try {
    const text = await file.text();
    let nodes;
    if (/\.json$/i.test(file.name) || text.trimStart().startsWith("{")) {
      nodes = normalizeJson(JSON.parse(text));
    } else {
      nodes = parseNetscape(text);
    }
    if (!nodes.length) throw new Error("empty");
    const urlSet = await collectUrls();
    const folder = await chrome.bookmarks.create({ title: `Imported — ${stamp()}` });
    const report = { imported: 0, skipped: 0 };
    await importNodes(folder.id, nodes, urlSet, report);
    box.innerHTML = "";
    const b = document.createElement("b");
    b.textContent = "Import complete";
    box.append(b, document.createElement("br"),
      document.createTextNode(`Imported ${report.imported} · skipped ${report.skipped} duplicates into “${folder.title}”.`));
  } catch (err) {
    box.textContent = "Couldn't read that file. Use a JSON backup from this extension or a Netscape-format HTML bookmark file.";
  } finally {
    e.target.value = "";
  }
}
