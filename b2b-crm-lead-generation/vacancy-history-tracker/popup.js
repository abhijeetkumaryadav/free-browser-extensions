// Vacancy History Tracker — popup logic.
// Job pipeline: saved → applied → interview → offer / rejected.
// Follow-up reminders are scheduled with chrome.alarms (see background.js).

const STATUSES = ["saved", "applied", "interview", "offer", "rejected"];
const ACTIVE = ["saved", "applied", "interview"]; // statuses where follow-ups matter
const $ = (id) => document.getElementById(id);
let filter = "all";
let view = "list";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("newBtn").addEventListener("click", () => { $("formCard").hidden = !$("formCard").hidden; });
  $("cancelBtn").addEventListener("click", () => { $("formCard").hidden = true; clearForm(); });
  $("saveBtn").addEventListener("click", saveJob);
  $("viewList").addEventListener("click", () => setView("list"));
  $("viewTime").addEventListener("click", () => setView("time"));
  $("fDate").value = todayStr();
  render();
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function getJobs() {
  const { jobs = [] } = await chrome.storage.local.get("jobs");
  return jobs;
}
async function setJobs(jobs) { await chrome.storage.local.set({ jobs }); }

function setView(v) {
  view = v;
  $("viewList").classList.toggle("on", v === "list");
  $("viewTime").classList.toggle("on", v === "time");
  $("list").hidden = v !== "list";
  $("timeline").hidden = v !== "time";
  render();
}

function clearForm() {
  $("fTitle").value = ""; $("fCompany").value = ""; $("fUrl").value = "";
  $("fDate").value = todayStr(); $("fStatus").value = "applied"; $("fFollow").value = "";
}

async function saveJob() {
  const title = $("fTitle").value.trim();
  const company = $("fCompany").value.trim();
  if (!title || !company) { ($("fTitle").value ? $("fCompany") : $("fTitle")).focus(); return; }
  const status = $("fStatus").value;
  const follow = $("fFollow").value || null;
  const job = {
    id: "job-" + Date.now(),
    title, company,
    url: $("fUrl").value.trim() || null,
    dateApplied: $("fDate").value || todayStr(),
    status,
    followUp: follow,
    history: [{ status, at: Date.now(), note: "Added" }],
  };
  const jobs = await getJobs();
  jobs.unshift(job);
  await setJobs(jobs.slice(0, 300));
  if (follow) scheduleFollowUp(job);
  clearForm();
  $("formCard").hidden = true;
  render();
}

async function scheduleFollowUp(job) {
  if (!job.followUp) return;
  const when = new Date(job.followUp + "T09:00:00").getTime();
  if (when <= Date.now()) return; // already due — shown as overdue badge instead
  try { await chrome.alarms.create("fu-" + job.id, { when }); } catch (e) {}
}
async function clearFollowUp(jobId) {
  try { await chrome.alarms.clear("fu-" + jobId); } catch (e) {}
}

async function setStatus(job, status) {
  if (job.status === status) return;
  const jobs = await getJobs();
  const j = jobs.find((x) => x.id === job.id);
  if (!j) return;
  j.status = status;
  j.history.push({ status, at: Date.now() });
  if (!ACTIVE.includes(status)) { j.followUp = null; await clearFollowUp(j.id); }
  await setJobs(jobs);
  render();
}

async function setFollowUp(job, dateStr) {
  const jobs = await getJobs();
  const j = jobs.find((x) => x.id === job.id);
  if (!j) return;
  await clearFollowUp(j.id);
  j.followUp = dateStr || null;
  await setJobs(jobs);
  if (j.followUp) scheduleFollowUp(j);
  render();
}

async function deleteJob(job) {
  await clearFollowUp(job.id);
  await setJobs((await getJobs()).filter((x) => x.id !== job.id));
  render();
}

function isOverdue(job) {
  if (!job.followUp || !ACTIVE.includes(job.status)) return false;
  return new Date(job.followUp + "T23:59:59").getTime() < Date.now();
}

async function render() {
  const jobs = await getJobs();
  renderStats(jobs);
  if (view === "list") renderList(jobs); else renderTimeline(jobs);
}

function renderStats(jobs) {
  const box = $("stats");
  box.innerHTML = "";
  const total = jobs.length;
  const mk = (key, label, color) => {
    const n = key === "all" ? total : jobs.filter((j) => j.status === key).length;
    const d = document.createElement("div");
    d.className = "stat" + (filter === key ? " on" : "");
    d.innerHTML = `<b style="color:${color}">${n}</b><span>${label}</span>`;
    d.addEventListener("click", () => { filter = (filter === key ? "all" : key); render(); });
    box.appendChild(d);
  };
  mk("all", "All", "#f4f6fb");
  mk("saved", "Saved", "var(--saved)");
  mk("applied", "Applied", "var(--applied)");
  mk("interview", "Interview", "var(--interview)");
  mk("offer", "Offer", "#4ade80");
  mk("rejected", "Rejected", "#f87171");
  box.style.gridTemplateColumns = "repeat(6,1fr)";
  $("subtitle").textContent = total
    ? `${total} application${total === 1 ? "" : "s"} · ${jobs.filter((j) => ACTIVE.includes(j.status)).length} active`
    : "Job application pipeline";
}

function filtered(jobs) {
  return filter === "all" ? jobs : jobs.filter((j) => j.status === filter);
}

function renderList(jobs) {
  const box = $("list");
  box.innerHTML = "";
  const items = filtered(jobs);
  if (!items.length) {
    box.innerHTML = `<div class="empty">${jobs.length ? "No applications with this status." : "No applications yet — hit ＋ New to add your first."}</div>`;
    return;
  }
  for (const job of items) {
    const card = document.createElement("div");
    card.className = "job";
    const top = document.createElement("div"); top.className = "top";
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = job.title;
    const sp = document.createElement("span"); sp.textContent = job.company;
    t.append(b, sp);
    const chip = document.createElement("span");
    chip.className = "chip " + job.status;
    chip.textContent = job.status;
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Delete";
    x.addEventListener("click", () => { if (confirm(`Delete "${job.title}"?`)) deleteJob(job); });
    top.append(t, chip, x);

    const meta = document.createElement("div"); meta.className = "meta";
    const sel = document.createElement("select");
    sel.title = "Status";
    for (const s of STATUSES) {
      const o = document.createElement("option");
      o.value = s; o.textContent = s[0].toUpperCase() + s.slice(1);
      if (s === job.status) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => setStatus(job, sel.value));
    const date = document.createElement("span");
    date.className = "date";
    date.textContent = "Applied " + fmtDate(job.dateApplied);
    meta.append(sel, date);
    if (job.url) {
      const a = document.createElement("a");
      a.className = "link"; a.href = job.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "↗ Posting";
      meta.appendChild(a);
    }
    if (job.followUp && ACTIVE.includes(job.status)) {
      const fu = document.createElement("span");
      fu.className = "fu" + (isOverdue(job) ? " over" : "");
      fu.textContent = (isOverdue(job) ? "Follow up! " : "Remind ") + fmtDate(job.followUp);
      meta.appendChild(fu);
    }
    const fuEdit = document.createElement("input");
    fuEdit.type = "date"; fuEdit.value = job.followUp || "";
    fuEdit.title = "Follow-up reminder date";
    fuEdit.style.cssText = "background:rgba(255,255,255,.05);border:1px solid var(--glass-border);color:var(--ink);border-radius:8px;padding:6px 8px;font-size:11px;";
    fuEdit.addEventListener("change", () => setFollowUp(job, fuEdit.value));
    meta.appendChild(fuEdit);

    const toggle = document.createElement("button");
    toggle.className = "hist-toggle";
    toggle.textContent = `▸ History (${job.history.length})`;
    const hist = document.createElement("div");
    hist.className = "hist";
    const colorFor = (s) => ({ saved: "#9aa3b5", applied: "#0ea5e9", interview: "#a78bfa", offer: "#22c55e", rejected: "#ef4444" }[s] || "#9aa3b5");
    for (const h of [...job.history].reverse()) {
      const ev = document.createElement("div");
      ev.className = "hist-ev";
      const dot = document.createElement("i");
      dot.style.background = colorFor(h.status);
      const tx = document.createElement("span");
      tx.textContent = `${h.note === "Added" ? "Added as" : "Moved to"} ${h.status} · ${new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
      ev.append(dot, tx);
      hist.appendChild(ev);
    }
    toggle.addEventListener("click", () => {
      hist.classList.toggle("open");
      toggle.textContent = (hist.classList.contains("open") ? "▾" : "▸") + ` History (${job.history.length})`;
    });

    card.append(top, meta, toggle, hist);
    box.appendChild(card);
  }
}

function renderTimeline(jobs) {
  const box = $("timeline");
  box.innerHTML = "";
  const events = [];
  for (const job of jobs) {
    for (const h of job.history) {
      events.push({ job, status: h.status, at: h.at, added: h.note === "Added" });
    }
  }
  events.sort((a, b) => b.at - a.at);
  if (!events.length) {
    box.innerHTML = `<div class="empty">Nothing yet — your application history will appear here.</div>`;
    return;
  }
  const colorFor = (s) => ({ saved: "#9aa3b5", applied: "#0ea5e9", interview: "#a78bfa", offer: "#22c55e", rejected: "#ef4444" }[s] || "#9aa3b5");
  for (const e of events.slice(0, 60)) {
    const d = document.createElement("div");
    d.className = "tl-ev";
    const dot = document.createElement("i");
    dot.style.background = colorFor(e.status);
    const b = document.createElement("b");
    b.textContent = `${e.job.company} — ${e.job.title}`;
    const sp = document.createElement("span");
    sp.textContent = `${e.added ? "Added as" : "Moved to"} ${e.status} · ${new Date(e.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
    d.append(dot, b, sp);
    box.appendChild(d);
  }
}
