/* Air Diary — manual air-quality journal.
 * 100% local: chrome.storage.local only. No network, no content script.
 * Honest scope: user's own observations — NOT live AQI or pollen data. */

const SYMPTOMS = [
  "Sneezing",
  "Itchy eyes",
  "Runny nose",
  "Cough",
  "Headache",
  "Breathing difficulty",
  "Skin irritation",
  "Fatigue"
];

// ---- Storage ----
async function loadEntries() {
  const { entries = [] } = await chrome.storage.local.get("entries");
  return entries;
}
async function saveEntries(entries) {
  await chrome.storage.local.set({ entries });
}
async function loadSettings() {
  const { reminder = null } = await chrome.storage.local.get("reminder");
  return reminder; // { threshold: n } or null
}
async function saveSettings(reminder) {
  await chrome.storage.local.set({ reminder });
}

// ---- Form state ----
let airValue = 2;
let pollenValue = 2;

function buildScale(id, get, set) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = i;
    b.title = i + " of 5";
    if (i === get()) b.classList.add("selected");
    b.addEventListener("click", () => {
      set(i);
      el.querySelectorAll("button").forEach(x => x.classList.remove("selected"));
      b.classList.add("selected");
    });
    el.appendChild(b);
  }
}

function buildSymptoms() {
  const box = document.getElementById("symptom-list");
  box.innerHTML = "";
  SYMPTOMS.forEach(s => {
    const row = document.createElement("label");
    row.className = "sym-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = s;
    const span = document.createElement("span");
    span.textContent = s;
    row.append(cb, span);
    box.appendChild(row);
  });
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---- Log submit ----
async function onSubmit(e) {
  e.preventDefault();
  const date = document.getElementById("f-date").value || todayISO();
  const symptoms = [...document.querySelectorAll("#symptom-list input:checked")].map(x => x.value);
  const notes = document.getElementById("f-notes").value.trim();
  const entries = await loadEntries();
  const existing = entries.findIndex(x => x.date === date);
  const entry = { date, air: airValue, pollen: pollenValue, symptoms, notes };
  if (existing >= 0) entries[existing] = entry;
  else entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  await saveEntries(entries);
  // reset
  airValue = 2; pollenValue = 2;
  buildScale("air-scale", () => airValue, v => { airValue = v; });
  buildScale("pollen-scale", () => pollenValue, v => { pollenValue = v; });
  document.getElementById("f-notes").value = "";
  document.querySelectorAll("#symptom-list input").forEach(x => { x.checked = false; });
  await renderEntries();
  await renderTrends();
  await checkReminder();
}

// ---- Entry list ----
async function renderEntries() {
  const entries = (await loadEntries()).slice().reverse();
  const list = document.getElementById("entry-list");
  list.innerHTML = "";
  document.getElementById("entries-empty").style.display = entries.length ? "none" : "block";
  const airWords = ["", "Clear", "Good", "Moderate", "Poor", "Very poor"];
  entries.forEach(en => {
    const card = document.createElement("div");
    card.className = "entry-card";
    const h = document.createElement("h3");
    h.textContent = fmtDate(en.date);
    const meta = document.createElement("div");
    meta.className = "entry-meta";
    const airB = document.createElement("b"); airB.textContent = `${en.air}/5 ${airWords[en.air]}`;
    const polB = document.createElement("b"); polB.textContent = `${en.pollen}/5`;
    meta.append("Air: ", airB, "  ·  Pollen: ", polB);
    if (en.symptoms && en.symptoms.length) {
      const s = document.createElement("div");
      s.className = "entry-meta";
      s.textContent = "Symptoms: " + en.symptoms.join(", ");
      card.append(h, meta, s);
    } else {
      card.append(h, meta);
    }
    if (en.notes) {
      const n = document.createElement("div");
      n.className = "entry-notes";
      n.textContent = en.notes;
      card.appendChild(n);
    }
    const acts = document.createElement("div");
    acts.className = "entry-actions";
    const del = document.createElement("button");
    del.className = "btn small danger";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      await saveEntries((await loadEntries()).filter(x => x.date !== en.date));
      await renderEntries();
      await renderTrends();
      await checkReminder();
    });
    acts.appendChild(del);
    card.appendChild(acts);
    list.appendChild(card);
  });
}

// ---- Trends chart ----
function drawChart(entries) {
  const c = document.getElementById("trend-canvas");
  const ctx = c.getContext("2d");
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  const pad = 28;
  // gridlines for 1..5
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "9px system-ui";
  ctx.lineWidth = 1;
  for (let v = 1; v <= 5; v++) {
    const y = pad + (H - 2 * pad) * (1 - (v - 1) / 4);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - 8, y); ctx.stroke();
    ctx.fillText(String(v), 12, y + 3);
  }
  if (entries.length < 2) {
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "11px system-ui";
    ctx.fillText("Log at least 2 days to see trends.", pad + 20, H / 2);
    return;
  }
  const n = entries.length;
  const x = i => pad + (W - pad - 8) * (i / (n - 1));
  const y = v => pad + (H - 2 * pad) * (1 - (v - 1) / 4);
  const line = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    entries.forEach((en, i) => {
      const px = x(i), py = y(en[key]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    entries.forEach((en, i) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x(i), y(en[key]), 3, 0, Math.PI * 2); ctx.fill();
    });
  };
  line("air", "#2dd4bf");
  line("pollen", "#f59e0b");
  // legend
  ctx.font = "10px system-ui";
  ctx.fillStyle = "#2dd4bf"; ctx.fillText("● Air", W - 88, 14);
  ctx.fillStyle = "#f59e0b"; ctx.fillText("● Pollen", W - 44, 14);
}

async function renderTrends() {
  const entries = await loadEntries();
  drawChart(entries);
  const stats = document.getElementById("trend-stats");
  stats.innerHTML = "";
  const mk = (v, k) => {
    const d = document.createElement("div");
    d.className = "stat";
    const vv = document.createElement("div"); vv.className = "v"; vv.textContent = v;
    const kk = document.createElement("div"); kk.className = "k"; kk.textContent = k;
    d.append(vv, kk);
    return d;
  };
  if (entries.length) {
    const avg = a => (a.reduce((s, e) => s + e, 0) / a.length).toFixed(1);
    const bad = entries.filter(e => e.air >= 4).length;
    stats.append(
      mk(entries.length, "days logged"),
      mk(avg(entries.map(e => e.air)), "avg air /5"),
      mk(bad, "bad-air days")
    );
  } else {
    stats.append(mk("–", "days logged"), mk("–", "avg air /5"), mk("–", "bad-air days"));
  }
  // symptom frequency
  const freq = {};
  entries.forEach(e => (e.symptoms || []).forEach(s => { freq[s] = (freq[s] || 0) + 1; }));
  const box = document.getElementById("symptom-stats");
  box.innerHTML = "";
  const names = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
  if (!names.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No symptoms logged yet.";
    box.appendChild(p);
  } else {
    names.forEach(s => {
      const row = document.createElement("div");
      row.className = "sym-stat";
      const nm = document.createElement("span"); nm.textContent = s;
      const ct = document.createElement("span"); ct.className = "count"; ct.textContent = freq[s] + "×";
      row.append(nm, ct);
      box.appendChild(row);
    });
  }
}

// ---- Reminders ----
async function checkReminder() {
  const reminder = await loadSettings();
  const banner = document.getElementById("reminder-banner");
  const status = document.getElementById("reminder-status");
  if (!reminder) {
    banner.classList.add("hidden");
    status.textContent = "Reminders are off.";
    return;
  }
  status.textContent = `On: alert when bad-air days (≥4) in the last 7 days reach ${reminder.threshold}.`;
  const entries = await loadEntries();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const bad = entries.filter(e => {
    const [y, m, d] = e.date.split("-").map(Number);
    return new Date(y, m - 1, d) >= cutoff && e.air >= 4;
  }).length;
  if (bad >= reminder.threshold) {
    banner.innerHTML = "";
    banner.classList.remove("hidden");
    const t = document.createElement("span");
    t.innerHTML = `<strong>${bad}</strong> bad-air days logged in the last 7 days (your threshold: ${reminder.threshold}). Consider checking your local air-quality authority.`;
    banner.appendChild(t);
  } else {
    banner.classList.add("hidden");
  }
}

// ---- Tabs ----
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("active", p.id === "tab-" + name));
  if (name === "trends") renderTrends();
}

// ---- Init ----
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("f-date").value = todayISO();
  buildScale("air-scale", () => airValue, v => { airValue = v; });
  buildScale("pollen-scale", () => pollenValue, v => { pollenValue = v; });
  buildSymptoms();
  await renderEntries();
  await renderTrends();
  await checkReminder();

  const reminder = await loadSettings();
  if (reminder) document.getElementById("r-threshold").value = reminder.threshold;

  document.querySelectorAll(".tab").forEach(t =>
    t.addEventListener("click", () => switchTab(t.dataset.tab)));
  document.getElementById("log-form").addEventListener("submit", onSubmit);

  document.getElementById("btn-save-reminder").addEventListener("click", async () => {
    const n = Math.min(7, Math.max(1, parseInt(document.getElementById("r-threshold").value, 10) || 3));
    await saveSettings({ threshold: n });
    await checkReminder();
  });
  document.getElementById("btn-disable-reminder").addEventListener("click", async () => {
    await saveSettings(null);
    await checkReminder();
  });
});
