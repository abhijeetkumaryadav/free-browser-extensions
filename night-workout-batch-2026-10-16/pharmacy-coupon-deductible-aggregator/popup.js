/* Pharmacy Price Log — personal pharmacy price logbook + manual
 * deductible-spend tracker.
 * Honest scope: the user logs prices THEY were quoted and enters THEIR OWN
 * deductible spending manually. The extension never fetches live coupon data,
 * never aggregates external coupons, and never gives medical advice. */

"use strict";

const QUOTES_KEY = "pharmacyQuotes"; // Array of { id, med, pharmacy, price, toward, ts }
const TARGET_KEY = "deductibleTarget"; // Number or null

/* ---------- storage helpers ---------- */

async function loadState() {
  const data = await chrome.storage.local.get([QUOTES_KEY, TARGET_KEY]);
  return {
    quotes: Array.isArray(data[QUOTES_KEY]) ? data[QUOTES_KEY] : [],
    target: typeof data[TARGET_KEY] === "number" ? data[TARGET_KEY] : null,
  };
}

/* ---------- formatting ---------- */

function fmt(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---------- deductible tracker ---------- */

function renderDeductible(quotes, target) {
  const spent = quotes.filter((q) => q.toward).reduce((a, q) => a + q.price, 0);
  const bar = document.getElementById("progress-bar");
  const text = document.getElementById("progress-text");
  const targetInput = document.getElementById("deductible-target");

  if (target == null || target <= 0) {
    bar.style.width = "0%";
    text.textContent = `Logged toward deductible: ${fmt(spent)} — set a target to track progress.`;
  } else {
    const pct = Math.min(100, (spent / target) * 100);
    bar.style.width = pct.toFixed(1) + "%";
    const remaining = Math.max(0, target - spent);
    text.textContent =
      remaining > 0
        ? `${fmt(spent)} of ${fmt(target)} logged — ${fmt(remaining)} remaining.`
        : `Deductible met: ${fmt(spent)} logged of ${fmt(target)} target.`;
  }

  if (document.activeElement !== targetInput && target != null) {
    targetInput.value = target;
  }
}

/* ---------- medication list ---------- */

function renderMeds(quotes, onDelete, onClear) {
  const list = document.getElementById("med-list");
  const empty = document.getElementById("empty");
  list.innerHTML = "";

  // Group by normalized medication name, preserving first-seen order.
  const groups = new Map();
  for (const q of quotes) {
    const key = q.med.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: q.med.trim(), items: [] });
    groups.get(key).items.push(q);
  }

  empty.hidden = groups.size > 0;

  for (const { name, items } of groups.values()) {
    const cheapest = Math.min(...items.map((q) => q.price));

    const card = document.createElement("div");
    card.className = "med";

    const head = document.createElement("div");
    head.className = "med-head";
    const title = document.createElement("strong");
    title.textContent = name;
    const cheap = document.createElement("span");
    cheap.className = "cheapest";
    cheap.textContent = `Cheapest: ${fmt(cheapest)}`;
    const clear = document.createElement("button");
    clear.textContent = "Clear";
    clear.title = "Remove all quotes for this medication";
    clear.addEventListener("click", () => onClear(items.map((q) => q.id)));
    head.append(title, cheap, clear);

    const ul = document.createElement("ul");
    ul.className = "entries";
    for (const q of items.slice().sort((a, b) => b.ts - a.ts)) {
      const li = document.createElement("li");
      const info = document.createElement("span");
      info.textContent = `${q.pharmacy} · ${fmtDate(q.ts)} · ${fmt(q.price)}`;
      if (q.toward) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = "deductible";
        info.appendChild(tag);
      }
      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "✕";
      del.title = "Delete quote";
      del.addEventListener("click", () => onDelete(q.id));
      li.append(info, del);
      ul.appendChild(li);
    }

    card.append(head, ul);
    list.appendChild(card);
  }
}

/* ---------- full render ---------- */

async function render() {
  const { quotes, target } = await loadState();

  renderDeductible(quotes, target);

  const removeQuotes = async (ids) => {
    const idSet = new Set(ids);
    const { quotes: current } = await loadState();
    await chrome.storage.local.set({ [QUOTES_KEY]: current.filter((q) => !idSet.has(q.id)) });
    render();
  };

  renderMeds(
    quotes,
    (id) => removeQuotes([id]),
    (ids) => removeQuotes(ids)
  );
}

/* ---------- events ---------- */

function showError(msg) {
  const el = document.getElementById("form-error");
  el.textContent = msg;
  el.hidden = !msg;
}

document.getElementById("add").addEventListener("click", async () => {
  const med = document.getElementById("med").value.trim();
  const pharmacy = document.getElementById("pharmacy").value.trim();
  const price = parseFloat(document.getElementById("price").value);
  const toward = document.getElementById("toward").checked;

  if (!med) return showError("Enter the medication name.");
  if (!pharmacy) return showError("Enter the pharmacy that quoted it.");
  if (!Number.isFinite(price) || price <= 0) return showError("Enter a valid price above 0.");
  showError("");

  const { quotes } = await loadState();
  quotes.push({ id: crypto.randomUUID(), med, pharmacy, price, toward, ts: Date.now() });
  await chrome.storage.local.set({ [QUOTES_KEY]: quotes });

  document.getElementById("med").value = "";
  document.getElementById("pharmacy").value = "";
  document.getElementById("price").value = "";
  render();
});

document.getElementById("save-target").addEventListener("click", async () => {
  const target = parseFloat(document.getElementById("deductible-target").value);
  if (!Number.isFinite(target) || target <= 0) {
    await chrome.storage.local.remove(TARGET_KEY);
  } else {
    await chrome.storage.local.set({ [TARGET_KEY]: target });
  }
  render();
});

/* ---------- init ---------- */

render();
