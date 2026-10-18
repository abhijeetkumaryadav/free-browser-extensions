/* Daily Protein & Macro Tracker — popup logic.
   Everything is local (chrome.storage.local). Calorie estimate uses the
   standard Atwater factors: protein 4, carbs 4, fat 9 kcal/g. */

const MACROS = [
  { key: "protein", label: "Protein" },
  { key: "carbs",   label: "Carbs" },
  { key: "fat",     label: "Fat" },
];
const KCAL = { protein: 4, carbs: 4, fat: 9 };
const DEFAULT_TARGETS = { protein: 150, carbs: 250, fat: 65 };

const $ = (id) => document.getElementById(id);

/* ENGINE-START: pure helpers, headless-testable */
function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function sumMacros(meals) {
  const t = { protein: 0, carbs: 0, fat: 0 };
  for (const m of meals || []) {
    t.protein += num(m.protein); t.carbs += num(m.carbs); t.fat += num(m.fat);
  }
  return t;
}
function num(v) { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : 0; }
function estCalories(totals) {
  return totals.protein * KCAL.protein + totals.carbs * KCAL.carbs + totals.fat * KCAL.fat;
}
function pctOf(value, target) {
  if (!(target > 0)) return 0;
  return Math.min(100, (value / target) * 100);
}
/* ENGINE-END */

let state = { targets: { ...DEFAULT_TARGETS }, days: {} };

async function load() {
  const res = await chrome.storage.local.get(["targets", "days"]);
  if (res.targets) state.targets = { ...DEFAULT_TARGETS, ...res.targets };
  if (res.days) state.days = res.days;
}
async function save() {
  await chrome.storage.local.set({ targets: state.targets, days: state.days });
}

function getTodayMeals() {
  const k = todayKey();
  if (!state.days[k]) state.days[k] = [];
  return state.days[k];
}

function render() {
  const t = state.targets;
  $("tv-protein").textContent = `${t.protein} g`;
  $("tv-carbs").textContent = `${t.carbs} g`;
  $("tv-fat").textContent = `${t.fat} g`;

  const totals = sumMacros(getTodayMeals());
  $("cal-est").textContent = `≈ ${Math.round(estCalories(totals))} kcal`;

  const bars = $("bars");
  bars.innerHTML = "";
  for (const m of MACROS) {
    const v = Math.round(totals[m.key] * 10) / 10;
    const tgt = t[m.key];
    const pct = pctOf(v, tgt);
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML =
      `<div class="bar-top"><span class="m-name">${m.label}</span>` +
      `<span class="m-val">${v} / ${tgt} g</span></div>` +
      `<div class="bar-track"><div class="bar-fill${v > tgt ? " over" : ""}" style="width:${pct}%"></div></div>`;
    bars.appendChild(row);
  }

  renderMeals();
  renderHistory();
}

function renderMeals() {
  const meals = getTodayMeals();
  const list = $("meal-list");
  list.innerHTML = "";
  $("meal-empty").style.display = meals.length ? "none" : "block";
  meals.forEach((m, i) => {
    const li = document.createElement("li");
    li.className = "meal-item";
    const kcal = Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9);
    li.innerHTML =
      `<span class="m-name"></span>` +
      `<span class="m-macros">P ${m.protein} · C ${m.carbs} · F ${m.fat} · ${kcal} kcal</span>` +
      `<button class="del" aria-label="Delete meal">×</button>`;
    li.querySelector(".m-name").textContent = m.name;
    li.querySelector(".del").addEventListener("click", async () => {
      getTodayMeals().splice(i, 1);
      await save();
      render();
    });
    list.appendChild(li);
  });
}

function renderHistory() {
  const keys = Object.keys(state.days)
    .filter((k) => k !== todayKey() && state.days[k].length)
    .sort()
    .reverse()
    .slice(0, 14);
  const list = $("hist-list");
  list.innerHTML = "";
  $("hist-empty").style.display = keys.length ? "none" : "block";
  for (const k of keys) {
    const totals = sumMacros(state.days[k]);
    const li = document.createElement("li");
    li.className = "hist-item";
    li.innerHTML =
      `<span class="h-date">${k}</span>` +
      `<span>P ${r1(totals.protein)} · C ${r1(totals.carbs)} · F ${r1(totals.fat)}</span>` +
      `<span class="h-kcal">≈ ${Math.round(estCalories(totals))} kcal</span>`;
    list.appendChild(li);
  }
}
function r1(v) { return Math.round(v * 10) / 10; }

function bind() {
  $("toggle-targets").addEventListener("click", () => {
    const editing = $("targets-edit").classList.toggle("hidden");
    $("targets-view").classList.toggle("hidden", !editing);
    if (!editing) {
      $("in-t-protein").value = state.targets.protein;
      $("in-t-carbs").value = state.targets.carbs;
      $("in-t-fat").value = state.targets.fat;
    }
  });
  $("save-targets").addEventListener("click", async () => {
    const p = num($("in-t-protein").value), c = num($("in-t-carbs").value), f = num($("in-t-fat").value);
    state.targets = { protein: p || DEFAULT_TARGETS.protein, carbs: c || DEFAULT_TARGETS.carbs, fat: f || DEFAULT_TARGETS.fat };
    await save();
    $("targets-edit").classList.add("hidden");
    $("targets-view").classList.remove("hidden");
    render();
  });
  $("add-meal").addEventListener("click", async () => {
    const meal = {
      name: $("meal-name").value.trim() || "Unnamed meal",
      protein: num($("g-protein").value),
      carbs: num($("g-carbs").value),
      fat: num($("g-fat").value),
      ts: Date.now(),
    };
    getTodayMeals().push(meal);
    await save();
    $("meal-name").value = ""; $("g-protein").value = ""; $("g-carbs").value = ""; $("g-fat").value = "";
    render();
  });
  $("clear-day").addEventListener("click", async () => {
    if (!confirm("Clear today's meals?")) return;
    state.days[todayKey()] = [];
    await save();
    render();
  });
  $("clear-history").addEventListener("click", async () => {
    if (!confirm("Clear all past-day history?")) return;
    const k = todayKey();
    state.days = { [k]: state.days[k] || [] };
    await save();
    render();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bind();
  await load();
  render();
});
