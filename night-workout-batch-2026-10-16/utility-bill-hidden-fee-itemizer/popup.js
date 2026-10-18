/* BillFee Itemizer — all data local in chrome.storage.local. No network, no accounts. */

/** Patterns for suspicious-sounding fee line items. Each has a plain-language explanation. */
const FEE_PATTERNS = [
  { re: /convenience\s*fee/i, why: "A fee just for paying — often for using a credit card or paying online. Ask if there's a free payment method." },
  { re: /(service|processing|transaction)\s*(charge|fee)/i, why: "A vague extra charge on top of the actual service. Ask what service this pays for." },
  { re: /regulatory|compliance/i, why: "Sounds official, but this is usually the company passing its own compliance costs to you. Verify it's required." },
  { re: /administrative|admin\.?\s*fee/i, why: "A catch-all 'paperwork' fee. Ask for an itemized breakdown of what it covers." },
  { re: /paper\s*(bill|statement|invoice)/i, why: "A charge for receiving a paper bill. Switching to e-billing usually removes it." },
  { re: /late\s*(fee|charge|penalty)/i, why: "Penalty for late payment. Check the due date and whether a grace period applies." },
  { re: /reconnection|restoration/i, why: "Charged to turn service back on after a shutoff. Ask if it can be reduced or waived on first occurrence." },
  { re: /equipment|device|rental|lease/i, why: "A recurring rental for equipment (modem, meter, box). Buying your own can be cheaper over time." },
  { re: /installation|activation|setup/i, why: "One-time setup charge. Ask if it can be waived — many providers do waive it if asked." },
  { re: /termination|early\s*cancellation|cancellation/i, why: "Penalty for ending a contract early. Check your contract's end date before accepting it." },
  { re: /overage|excess\s*usage/i, why: "Extra charge for going over an allowance. Review whether your plan's allowance fits your usage." },
  { re: /premium|priority|expedited/i, why: "A fee for faster service. Make sure you actually requested and received it." },
  { re: /miscellaneous|misc\.?|other\s*(charges|fees)/i, why: "'Miscellaneous' is not an explanation — ask for each item to be named and justified." },
  { re: /surcharg/i, why: "A surcharge is an extra fee added to the base price. Ask which costs it recovers and whether it's mandatory." },
  { re: /delivery|handling/i, why: "A charge for getting the product/service to you. Check if it's disclosed before checkout or only on the bill." },
];

/** Format a number as USD. */
function money(n) {
  const v = Number(n) || 0;
  return (v < 0 ? "-$" : "$") + Math.abs(v).toFixed(2);
}

/** Return the first matching fee pattern for a line label, or null. */
function flagFee(label) {
  for (const p of FEE_PATTERNS) {
    if (p.re.test(label)) return p;
  }
  return null;
}

/* ---------- storage ---------- */
const KEY = "billfee_bills_v1";

async function loadBills() {
  const r = await chrome.storage.local.get(KEY);
  return Array.isArray(r[KEY]) ? r[KEY] : [];
}
async function saveBills(bills) {
  await chrome.storage.local.set({ [KEY]: bills });
}
function uid() {
  return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- computed ---------- */
function billTotal(bill) {
  return bill.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
}
function flaggedLines(bill) {
  return bill.lines
    .map((l, i) => ({ line: l, index: i, pattern: flagFee(l.label) }))
    .filter((x) => x.pattern);
}

/* ---------- rendering ---------- */
const billListEl = document.getElementById("billList");
const providerFilterEl = document.getElementById("providerFilter");
const flagListEl = document.getElementById("flagList");

function renderStats(bills) {
  document.getElementById("statBills").textContent = bills.length;
  const total = bills.reduce((s, b) => s + billTotal(b), 0);
  document.getElementById("statTotal").textContent = money(total);
  document.getElementById("statAvg").textContent = money(bills.length ? total / bills.length : 0);
  const flags = bills.reduce((s, b) => s + flaggedLines(b).length, 0);
  document.getElementById("statFlags").textContent = flags;
  document.getElementById("flagPill").textContent = flags;
}

function renderProviders(bills) {
  const current = providerFilterEl.value;
  const providers = [...new Set(bills.map((b) => b.provider).filter(Boolean))].sort();
  providerFilterEl.innerHTML = '<option value="">All providers</option>' +
    providers.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  if (providers.includes(current)) providerFilterEl.value = current;
}

function renderBills(bills) {
  const f = providerFilterEl.value;
  const shown = f ? bills.filter((b) => b.provider === f) : bills;
  if (!shown.length) {
    billListEl.innerHTML = '<div class="empty">No bills yet. Use the "Add bill" tab to log your first bill.</div>';
    return;
  }
  const sorted = [...shown].sort((a, b) => (b.month || "").localeCompare(a.month || ""));
  billListEl.innerHTML = sorted.map((b) => {
    const flags = flaggedLines(b);
    const linesHtml = b.lines.map((l) => {
      const fp = flagFee(l.label);
      return `<li class="${fp ? "flagged" : ""}">
        <span class="lbl">${esc(l.label)} <span class="tag ${esc(l.type)}">${esc(l.type)}</span></span>
        <span class="amt">${money(l.amount)}</span>
      </li>`;
    }).join("");
    return `<div class="bill" data-id="${b.id}">
      <div class="bill-top">
        <div><strong>${esc(b.provider)}</strong><span class="month">${esc(b.month || "")}</span></div>
        <button class="btn danger" data-del="${b.id}">Delete</button>
      </div>
      <div class="bill-total-row"><span>${b.lines.length} line item(s)${flags.length ? ` · ${flags.length} flagged` : ""}</span><strong>${money(billTotal(b))}</strong></div>
      <ul class="lines">${linesHtml}</ul>
    </div>`;
  }).join("");
}

function renderFlags(bills) {
  const items = [];
  for (const b of bills) {
    for (const f of flaggedLines(b)) {
      items.push({ bill: b, line: f.line, pattern: f.pattern });
    }
  }
  if (!items.length) {
    flagListEl.innerHTML = '<div class="empty">No suspicious-sounding fees found. Nice — your bills look clean!</div>';
    return;
  }
  flagListEl.innerHTML = items.map((it) => `
    <div class="flag">
      <div class="f-top"><strong>⚠ ${esc(it.line.label)}</strong><span class="f-amt">${money(it.line.amount)}</span></div>
      <div class="f-why">${esc(it.pattern.why)}</div>
      <div class="f-bill">From: ${esc(it.bill.provider)} · ${esc(it.bill.month || "no date")}</div>
    </div>`).join("");
}

async function refresh() {
  const bills = await loadBills();
  renderStats(bills);
  renderProviders(bills);
  renderBills(bills);
  renderFlags(bills);
}

/* ---------- add-bill form ---------- */
const lineItemsEl = document.getElementById("lineItems");

function addLineRow(label = "", amount = "", type = "charge") {
  const row = document.createElement("div");
  row.className = "line-row";
  row.innerHTML = `
    <input type="text" class="li-label" placeholder="Line item, e.g. Convenience fee" value="${esc(label)}" maxlength="80" required>
    <input type="number" class="li-amount" placeholder="0.00" step="0.01" min="0" value="${esc(amount)}" required>
    <select class="li-type">
      <option value="charge"${type === "charge" ? " selected" : ""}>Charge</option>
      <option value="fee"${type === "fee" ? " selected" : ""}>Fee</option>
      <option value="tax"${type === "tax" ? " selected" : ""}>Tax</option>
    </select>
    <button type="button" class="line-del" title="Remove line" aria-label="Remove line">×</button>`;
  row.querySelector(".line-del").addEventListener("click", () => { row.remove(); updateBillTotal(); });
  row.querySelectorAll("input").forEach((i) => i.addEventListener("input", updateBillTotal));
  lineItemsEl.appendChild(row);
  updateBillTotal();
}

function updateBillTotal() {
  let t = 0;
  lineItemsEl.querySelectorAll(".li-amount").forEach((i) => { t += Number(i.value) || 0; });
  document.getElementById("billTotal").textContent = money(t);
}

document.getElementById("addLineBtn").addEventListener("click", () => addLineRow());

document.getElementById("billForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const provider = document.getElementById("fProvider").value.trim();
  const month = document.getElementById("fMonth").value;
  const due = document.getElementById("fDue").value || "";
  const lines = [];
  for (const row of lineItemsEl.querySelectorAll(".line-row")) {
    const label = row.querySelector(".li-label").value.trim();
    const amount = Number(row.querySelector(".li-amount").value) || 0;
    const type = row.querySelector(".li-type").value;
    if (!label) continue;
    lines.push({ label, amount, type });
  }
  if (!lines.length) { alert("Add at least one line item."); return; }
  const bills = await loadBills();
  bills.push({ id: uid(), provider, month, due, lines, createdAt: Date.now() });
  await saveBills(bills);
  // reset form
  e.target.reset();
  lineItemsEl.innerHTML = "";
  addLineRow();
  await refresh();
  switchTab("bills");
});

/* ---------- delete / export / filter ---------- */
billListEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del]");
  if (!btn) return;
  if (!confirm("Delete this bill?")) return;
  const bills = (await loadBills()).filter((b) => b.id !== btn.dataset.del);
  await saveBills(bills);
  await refresh();
});

providerFilterEl.addEventListener("change", refresh);

document.getElementById("exportBtn").addEventListener("click", async () => {
  const bills = await loadBills();
  if (!bills.length) { alert("Nothing to export yet."); return; }
  const rows = [["provider", "month", "due", "line_label", "line_type", "amount", "flagged", "flag_reason"]];
  for (const b of bills) {
    for (const l of b.lines) {
      const p = flagFee(l.label);
      rows.push([b.provider, b.month || "", b.due || "", l.label, l.type, (Number(l.amount) || 0).toFixed(2), p ? "yes" : "no", p ? p.why : ""]);
    }
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "billfee-itemizer.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

/* ---------- tabs ---------- */
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

/* ---------- init ---------- */
addLineRow();
refresh();
