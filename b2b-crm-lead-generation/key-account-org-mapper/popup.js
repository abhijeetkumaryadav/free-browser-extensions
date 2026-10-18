// Key Account Org Mapper — all on-device, storage only.

const $ = (id) => document.getElementById(id);
let editingId = null;   // person id being edited, or null
let selectedId = null;  // person shown in detail card

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("acctBtn").addEventListener("click", newAccount);
  $("acctSel").addEventListener("change", () => { selectedId = null; render(); });
  $("saveBtn").addEventListener("click", savePerson);
  $("cancelEdit").addEventListener("click", resetForm);
  $("closeDet").addEventListener("click", () => { selectedId = null; $("detailCard").hidden = true; renderTree(); });
  $("editBtn").addEventListener("click", startEdit);
  $("delBtn").addEventListener("click", deletePerson);
  const data = await getData();
  if (!data.accounts.length) {
    data.accounts.push({ id: "acct-" + Date.now(), name: "Acme Corp", people: [] });
    await setData(data);
  }
  render();
}

async function getData() {
  const { orgData = { accounts: [] } } = await chrome.storage.local.get("orgData");
  return orgData;
}
async function setData(d) { await chrome.storage.local.set({ orgData: d }); }
function curAcct(data) {
  const id = $("acctSel").value || (data.accounts[0] && data.accounts[0].id);
  return data.accounts.find((a) => a.id === id) || data.accounts[0];
}

async function newAccount() {
  const data = await getData();
  const name = "Account " + (data.accounts.length + 1);
  const acct = { id: "acct-" + Date.now(), name, people: [] };
  data.accounts.push(acct);
  await setData(data);
  selectedId = null; resetForm();
  render();
  $("acctSel").value = acct.id;
  render();
}

async function savePerson() {
  const data = await getData();
  const acct = curAcct(data);
  if (!acct) return;
  const name = $("fName").value.trim();
  if (!name) { $("fName").focus(); return; }
  const mgr = $("fMgr").value || null;
  if (editingId) {
    const p = acct.people.find((x) => x.id === editingId);
    if (p) {
      p.name = name; p.title = $("fTitle").value.trim();
      p.dept = $("fDept").value.trim();
      p.reportsTo = mgr === editingId ? null : mgr; // no self-reporting
    }
    selectedId = editingId;
  } else {
    const p = {
      id: "p-" + Date.now(), name,
      title: $("fTitle").value.trim(), dept: $("fDept").value.trim(),
      reportsTo: mgr,
    };
    acct.people.push(p);
    selectedId = p.id;
  }
  await setData(data);
  resetForm();
  render();
}

function startEdit() {
  const p = currentPerson();
  if (!p) return;
  editingId = p.id;
  $("formTitle").textContent = "Edit person";
  $("fName").value = p.name; $("fTitle").value = p.title || ""; $("fDept").value = p.dept || "";
  $("saveBtn").textContent = "Save changes";
  $("cancelEdit").hidden = false;
  $("fMgr").value = p.reportsTo || "";
}

async function deletePerson() {
  if (!selectedId) return;
  const data = await getData();
  const acct = curAcct(data);
  acct.people = acct.people.filter((p) => p.id !== selectedId);
  // orphaned direct reports move up to top level
  for (const p of acct.people) {
    if (p.reportsTo === selectedId) p.reportsTo = null;
  }
  selectedId = null;
  $("detailCard").hidden = true;
  await setData(data);
  resetForm();
  render();
}

function resetForm() {
  editingId = null;
  $("formTitle").textContent = "Add person";
  $("fName").value = $("fTitle").value = $("fDept").value = "";
  $("saveBtn").textContent = "Add person";
  $("cancelEdit").hidden = true;
}

function currentPerson() {
  const acctId = $("acctSel").value;
  return { acctId, person: null }; // resolved in renderDetail
}

async function render() {
  const data = await getData();
  // account select
  const sel = $("acctSel");
  const prev = sel.value;
  sel.innerHTML = "";
  for (const a of data.accounts) {
    const o = document.createElement("option");
    o.value = a.id; o.textContent = a.name;
    sel.appendChild(o);
  }
  if (data.accounts.some((a) => a.id === prev)) sel.value = prev;
  renderTree();
  renderDetail();
  // manager select
  const acct = curAcct(data);
  const ms = $("fMgr");
  ms.innerHTML = "";
  const top = document.createElement("option");
  top.value = ""; top.textContent = "— Top level (no manager) —";
  ms.appendChild(top);
  if (acct) {
    const sorted = [...acct.people].sort((a, b) => a.name.localeCompare(b.name));
    for (const p of sorted) {
      if (editingId && p.id === editingId) continue;
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name + (p.title ? " · " + p.title : "");
      ms.appendChild(o);
    }
  }
}

function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

async function renderTree() {
  const data = await getData();
  const acct = curAcct(data);
  const wrap = $("treeWrap");
  wrap.innerHTML = "";
  if (!acct || !acct.people.length) {
    $("treeEmpty").style.display = "";
    return;
  }
  $("treeEmpty").style.display = "none";
  const byMgr = new Map();
  for (const p of acct.people) {
    const k = p.reportsTo || "__root__";
    if (!byMgr.has(k)) byMgr.set(k, []);
    byMgr.get(k).push(p);
  }
  // guard against dangling manager ids
  const ids = new Set(acct.people.map((p) => p.id));
  const roots = [...(byMgr.get("__root__") || [])];
  for (const p of acct.people) {
    if (p.reportsTo && !ids.has(p.reportsTo) && !roots.includes(p)) roots.push(p);
  }
  const ul = document.createElement("ul");
  ul.className = "tree";
  const seen = new Set();
  for (const r of roots.sort((a, b) => a.name.localeCompare(b.name))) {
    ul.appendChild(buildNode(r, byMgr, seen));
  }
  wrap.appendChild(ul);
}

function buildNode(p, byMgr, seen) {
  const li = document.createElement("li");
  li.className = "node";
  if (seen.has(p.id)) return li; // cycle guard
  seen.add(p.id);
  const card = document.createElement("div");
  card.className = "node-card" + (p.id === selectedId ? " sel" : "");
  const av = document.createElement("div");
  av.className = "av"; av.textContent = initials(p.name);
  const tx = document.createElement("div");
  tx.className = "tx";
  const b = document.createElement("b"); b.textContent = p.name; b.title = p.name;
  const s = document.createElement("span");
  s.textContent = [p.title, p.dept].filter(Boolean).join(" · ") || "—";
  tx.append(b, s);
  card.append(av, tx);
  card.addEventListener("click", () => { selectedId = p.id; renderTree(); renderDetail(); });
  li.appendChild(card);
  const kids = (byMgr.get(p.id) || []).sort((a, b) => a.name.localeCompare(b.name));
  if (kids.length) {
    const sub = document.createElement("ul");
    for (const k of kids) sub.appendChild(buildNode(k, byMgr, seen));
    li.appendChild(sub);
  }
  return li;
}

async function renderDetail() {
  const data = await getData();
  const acct = curAcct(data);
  const card = $("detailCard");
  const p = acct && acct.people.find((x) => x.id === selectedId);
  if (!p) { card.hidden = true; return; }
  card.hidden = false;
  $("dName").textContent = p.name;
  $("dTitle").textContent = p.title || "—";
  $("dDept").textContent = p.dept || "—";
  const mgr = acct.people.find((x) => x.id === p.reportsTo);
  $("dMgr").textContent = mgr ? mgr.name : "— (top level)";
  const reports = acct.people.filter((x) => x.reportsTo === p.id);
  $("dReports").textContent = reports.length ? reports.map((r) => r.name).join(", ") : "None";
}
