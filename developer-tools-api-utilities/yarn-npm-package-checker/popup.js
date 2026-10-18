// Yarn / npm Package Checker — popup logic.
// All lookups go to the public, CORS-open, read-only npm registry.
// Nothing is uploaded anywhere; the pasted JSON never leaves the machine.

const $ = (id) => document.getElementById(id);
let lastReport = "";

// --- small semver helpers (no deps) ---
function cleanVer(v) {
  // strip range prefixes like ^ ~ >= < and pre-release tags for comparison
  const m = String(v).trim().match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
}
function cmpVer(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

async function fetchLatest(name) {
  // /<pkg>/latest returns the latest published version document:
  // { version, license, deprecated?, name, description }
  const url = "https://registry.npmjs.org/" + encodeURIComponent(name).replace(/^%40/, "@") + "/latest";
  const res = await fetch(url);
  if (!res.ok) throw new Error("http-" + res.status);
  return res.json();
}

document.addEventListener("DOMContentLoaded", () => {
  $("analyze").addEventListener("click", analyze);
  $("copy").addEventListener("click", copyReport);
});

async function analyze() {
  const err = $("error");
  err.hidden = true;
  let deps = {};
  try {
    const parsed = JSON.parse($("pkgjson").value);
    Object.assign(deps, parsed.dependencies || {});
    Object.assign(deps, parsed.devDependencies || {});
    // also tolerate a bare { "name": "1.2.3", ... } block
    if (!Object.keys(deps).length) {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" && /^[~^<>=*\d]/.test(v)) deps[k] = v;
      }
    }
  } catch (e) {
    err.textContent = "That doesn't look like valid JSON — paste a package.json or a dependencies block.";
    err.hidden = false;
    return;
  }
  const names = Object.keys(deps);
  if (!names.length) {
    err.textContent = "No dependencies found in that JSON.";
    err.hidden = false;
    return;
  }
  const btn = $("analyze");
  btn.disabled = true;
  btn.textContent = `Checking ${names.length} packages…`;

  const settled = await Promise.allSettled(names.map((n) => fetchLatest(n)));

  const results = settled.map((s, i) => {
    const name = names[i];
    const yours = deps[name];
    if (s.status === "rejected") return { name, yours, status: "unknown" };
    const doc = s.value;
    const latest = doc.version || "?";
    const base = cleanVer(yours), lat = cleanVer(latest);
    let status = "ok";
    if (doc.deprecated) status = "deprecated";
    else if (base && lat && cmpVer(base, lat) < 0) status = "outdated";
    return { name, yours, latest, license: doc.license || "?", deprecated: !!doc.deprecated, status };
  });

  render(results);
  btn.disabled = false;
  btn.textContent = "Check packages";
}

function render(results) {
  $("resultsCard").hidden = false;
  const counts = { total: results.length, ok: 0, outdated: 0, deprecated: 0, unknown: 0 };
  const box = $("rows");
  box.innerHTML = "";
  const order = { deprecated: 0, outdated: 1, unknown: 2, ok: 3 };
  const sorted = [...results].sort((a, b) => order[a.status] - order[b.status]);

  const badgeMeta = {
    ok: ["ok", "Up to date"],
    outdated: ["warn", "Outdated"],
    deprecated: ["bad", "Deprecated"],
    unknown: ["gray", "Not found"],
  };

  for (const r of sorted) {
    counts[r.status === "unknown" ? "unknown" : r.status]++;
    const row = document.createElement("div");
    row.className = "prow";
    const nm = document.createElement("div");
    nm.className = "nm";
    const b = document.createElement("b");
    b.textContent = r.name;
    b.title = r.name;
    const s = document.createElement("span");
    s.textContent = r.status === "unknown" ? String(r.yours) : `${r.yours} → ${r.latest}`;
    const lic = document.createElement("span");
    lic.className = "lic";
    lic.textContent = "License: " + (r.license || "?");
    nm.append(b, s, lic);
    const [cls, label] = badgeMeta[r.status];
    const badge = document.createElement("span");
    badge.className = "badge " + cls;
    badge.textContent = label;
    row.append(nm, badge);
    box.appendChild(row);
  }
  $("cTotal").textContent = counts.total;
  $("cOk").textContent = counts.ok;
  $("cOut").textContent = counts.outdated;
  $("cDep").textContent = counts.deprecated;

  const lines = ["# Package check report", ""];
  for (const r of sorted) {
    lines.push(`- ${r.name}: ${r.yours} → ${r.latest || "?"} [${r.status}] (license: ${r.license || "?"})`);
  }
  lines.push("", `Totals: ${counts.ok} up to date, ${counts.outdated} outdated, ${counts.deprecated} deprecated, ${counts.unknown} not found.`);
  lastReport = lines.join("\n");
  $("copy").textContent = "Copy report";
}

async function copyReport() {
  if (!lastReport) return;
  try {
    await navigator.clipboard.writeText(lastReport);
    $("copy").textContent = "Copied ✓";
  } catch (e) {
    $("copy").textContent = "Copy failed";
  }
}
