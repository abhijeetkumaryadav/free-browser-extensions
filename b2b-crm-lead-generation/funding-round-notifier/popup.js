// Funding Round Notifier — popup logic. All data on-device; alarms fire local reminders.

const STAGES = ["Pre-seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "IPO", "Acquired", "Grant"];
const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("rStage").innerHTML = STAGES.map((s) => `<option>${s}</option>`).join("");
  $("addCompany").addEventListener("click", addCompany);
  $("addRound").addEventListener("click", addRound);
  $("tlCompany").addEventListener("change", renderTimeline);
  await rescheduleAll();
  renderAll();
}

async function getCompanies() {
  const { companies = [] } = await chrome.storage.local.get("companies");
  return companies;
}
async function setCompanies(cs) {
  await chrome.storage.local.set({ companies: cs });
}

async function scheduleFollowUp(c) {
  const name = "followup:" + c.id;
  try { await chrome.alarms.clear(name); } catch (e) {}
  if (!c.followUp) return;
  const when = new Date(c.followUp + "T09:00:00").getTime();
  if (!isNaN(when) && when > Date.now()) {
    try { await chrome.alarms.create(name, { when }); } catch (e) {}
  }
}

async function rescheduleAll() {
  for (const c of await getCompanies()) await scheduleFollowUp(c);
}

async function addCompany() {
  const name = $("cName").value.trim();
  if (!name) return;
  const cs = await getCompanies();
  const c = {
    id: "co-" + Date.now(),
    name,
    notes: $("cNotes").value.trim(),
    followUp: $("cFollow").value || null,
    rounds: [],
  };
  cs.unshift(c);
  await setCompanies(cs.slice(0, 200));
  await scheduleFollowUp(c);
  $("cName").value = $("cNotes").value = $("cFollow").value = "";
  renderAll();
}

async function addRound() {
  const cs = await getCompanies();
  const c = cs.find((x) => x.id === $("rCompany").value);
  if (!c) return;
  const amount = $("rAmount").value.trim();
  if (!amount) return;
  c.rounds.push({
    id: "r-" + Date.now(),
    stage: $("rStage").value,
    amount,
    date: $("rDate").value || new Date().toISOString().slice(0, 10),
  });
  await setCompanies(cs);
  $("rAmount").value = "";
  renderAll();
  $("tlCompany").value = c.id;
  renderTimeline();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function renderAll() {
  const cs = await getCompanies();
  // watchlist
  const box = $("watchlist");
  box.innerHTML = "";
  if (!cs.length) {
    const d = document.createElement("div");
    d.className = "empty-w";
    d.textContent = "No companies watched yet.";
    box.appendChild(d);
  }
  for (const c of cs) {
    const row = document.createElement("div");
    row.className = "w-row";
    const dot = document.createElement("div"); dot.className = "dot";
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = c.name;
    t.appendChild(b);
    if (c.notes) {
      const sp = document.createElement("span"); sp.textContent = c.notes; sp.title = c.notes;
      t.appendChild(sp);
    }
    row.append(dot, t);
    if (c.followUp) {
      const f = document.createElement("div"); f.className = "fdate";
      f.textContent = "⏰ " + c.followUp;
      row.appendChild(f);
    }
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×"; x.title = "Remove";
    x.addEventListener("click", async () => {
      const cur = await getCompanies();
      await setCompanies(cur.filter((i) => i.id !== c.id));
      try { await chrome.alarms.clear("followup:" + c.id); } catch (e) {}
      renderAll();
    });
    row.appendChild(x);
    box.appendChild(row);
  }
  // company selects
  for (const selId of ["rCompany", "tlCompany"]) {
    const sel = $(selId);
    const prev = sel.value;
    sel.innerHTML = cs.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
    if (cs.some((c) => c.id === prev)) sel.value = prev;
  }
  $("tlCard").hidden = cs.length === 0;
  renderTimeline();
}

async function renderTimeline() {
  const cs = await getCompanies();
  const c = cs.find((x) => x.id === $("tlCompany").value) || cs[0];
  const tl = $("timeline"), meta = $("tlMeta");
  tl.innerHTML = "";
  if (!c) { meta.textContent = ""; return; }
  $("tlTitle").textContent = c.name + " — timeline";
  meta.textContent = (c.followUp ? `Follow-up: ${c.followUp}  ·  ` : "") +
    `${c.rounds.length} round${c.rounds.length === 1 ? "" : "s"} logged` +
    (c.notes ? `  ·  ${c.notes}` : "");
  const rounds = [...c.rounds].sort((a, b) => b.date.localeCompare(a.date));
  if (!rounds.length) {
    const d = document.createElement("div");
    d.className = "tl-empty";
    d.textContent = "No rounds logged yet — add one above.";
    tl.appendChild(d);
    return;
  }
  for (const r of rounds) {
    const item = document.createElement("div");
    item.className = "tl-item";
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×"; x.title = "Delete round";
    x.addEventListener("click", async () => {
      const cur = await getCompanies();
      const co = cur.find((i) => i.id === c.id);
      if (co) co.rounds = co.rounds.filter((i) => i.id !== r.id);
      await setCompanies(cur);
      renderAll();
    });
    const stage = document.createElement("div"); stage.className = "stage"; stage.textContent = r.stage;
    const amt = document.createElement("div"); amt.className = "amt"; amt.textContent = r.amount;
    const dt = document.createElement("div"); dt.className = "dt"; dt.textContent = r.date;
    item.append(x, stage, amt, dt);
    tl.appendChild(item);
  }
}
