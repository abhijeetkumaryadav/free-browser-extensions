/* TokenTime popup — kid dashboard + PIN-gated parent controls. All state in chrome.storage.local. */
const $ = (id) => document.getElementById(id);
const DEFAULTS = { allowance: 60, sites: [], balance: 60, date: "", usage: {}, rewards: [], pinHash: "" };

/* ---------- storage helpers ---------- */
async function load() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}
async function save(patch) { await chrome.storage.local.set(patch); }

/* ---------- PIN (SHA-256, local only) ---------- */
async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("tokentime:" + pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- views ---------- */
let parentUnlocked = false;
function show(view) {
  for (const v of ["viewKid", "viewPin", "viewParent"]) $(v).classList.add("hidden");
  $(view).classList.remove("hidden");
  $("tabKid").classList.toggle("active", view === "viewKid");
  $("tabParent").classList.toggle("active", view !== "viewKid");
}
$("tabKid").onclick = () => { show("viewKid"); renderKid(); };
$("tabParent").onclick = () => { show(parentUnlocked ? "viewParent" : "viewPin"); };

/* ---------- kid dashboard ---------- */
async function renderKid() {
  const s = await load();
  $("kidBalance").textContent = s.balance;
  const spent = s.allowance - Math.min(s.balance, s.allowance + s.rewards.reduce((a, r) => a + r.tokens, 0));
  const pct = Math.max(0, Math.min(100, (s.balance / Math.max(1, s.allowance + s.rewards.reduce((a, r) => a + r.tokens, 0))) * 100));
  $("kidProgress").style.width = pct + "%";
  $("kidStatus").textContent = s.balance <= 0
    ? "Out of tokens! Ask a parent for a reward or try a free activity."
    : s.balance <= Math.max(5, s.allowance * 0.15)
      ? "Running low — spend wisely!"
      : "You're doing great. Keep it balanced!";

  const usage = s.usage || {};
  const rows = Object.entries(usage).sort((a, b) => b[1] - a[1]);
  $("kidUsage").innerHTML = rows.length
    ? rows.map(([d, m]) => `<div class="usage-item"><span class="dom">${esc(d)}</span><span class="meta">${m} min</span></div>`).join("")
    : `<p class="muted">No tracked sites visited yet today.</p>`;

  $("kidRewards").innerHTML = (s.rewards || []).length
    ? s.rewards.slice().reverse().map((r) => `<div class="usage-item"><span class="dom">+${r.tokens} <span class="meta">${esc(r.reason)}</span></span><span class="meta">${esc(r.when)}</span></div>`).join("")
    : `<p class="muted">No rewards yet — do something awesome!</p>`;
}
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- parent gate ---------- */
$("pinBtn").onclick = async () => {
  const s = await load();
  const pin = $("pinInput").value.trim();
  $("pinError").classList.add("hidden");
  if (!/^\d{4}$/.test(pin)) return pinFail("PIN must be 4 digits.");
  const h = await hashPin(pin);
  if (!s.pinHash) {                       // first run: set the PIN
    await save({ pinHash: h });
    parentUnlocked = true; show("viewParent"); renderParent();
    $("pinHint").textContent = "Enter your 4-digit parent PIN.";
  } else if (h === s.pinHash) {
    parentUnlocked = true; show("viewParent"); renderParent();
  } else pinFail("Wrong PIN. Try again.");
  $("pinInput").value = "";
};
function pinFail(msg) { const e = $("pinError"); e.textContent = msg; e.classList.remove("hidden"); }
$("pinInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("pinBtn").click(); });

/* ---------- parent dashboard ---------- */
async function renderParent() {
  const s = await load();
  $("allowanceInput").value = s.allowance;
  $("siteList").innerHTML = (s.sites || []).length
    ? s.sites.map((w, i) => `<div class="usage-item"><span class="dom">${esc(w.domain)}</span><span><span class="cost">${w.cost}/min</span> <button class="btn danger" data-del="${i}">✕</button></span></div>`).join("")
    : `<p class="muted">No sites tracked — add one above.</p>`;
  $("siteList").querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = async () => {
      const cur = await load();
      cur.sites.splice(+b.dataset.del, 1);
      await save({ sites: cur.sites }); renderParent();
    };
  });
}
$("allowanceBtn").onclick = async () => {
  const v = Math.max(1, Math.min(9999, parseInt($("allowanceInput").value, 10) || 0));
  if (!v) return;
  const s = await load();
  const delta = v - s.allowance;
  await save({ allowance: v, balance: Math.max(0, s.balance + delta) });
  renderParent(); renderKid();
};
$("siteAddBtn").onclick = async () => {
  let d = $("siteDomain").value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  const cost = Math.max(1, Math.min(100, parseInt($("siteCost").value, 10) || 1));
  if (!d || !d.includes(".")) return;
  d = d.replace(/^www\./, "");
  const s = await load();
  if (!s.sites.some((w) => w.domain === d)) s.sites.push({ domain: d, cost });
  await save({ sites: s.sites });
  $("siteDomain").value = ""; $("siteCost").value = "";
  renderParent();
};
$("rewardBtn").onclick = async () => {
  const tokens = Math.max(1, Math.min(999, parseInt($("rewardTokens").value, 10) || 0));
  const reason = $("rewardReason").value.trim() || "Good job";
  if (!tokens) return;
  const s = await load();
  const when = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  await save({ balance: s.balance + tokens, rewards: [...(s.rewards || []), { tokens, reason, when }] });
  $("rewardTokens").value = ""; $("rewardReason").value = "";
  renderParent();
};
$("resetDayBtn").onclick = async () => {
  const s = await load();
  await save({ balance: s.allowance, usage: {}, rewards: [], date: new Date().toDateString() });
  renderParent();
};
$("changePinBtn").onclick = async () => {
  const pin = prompt("Enter a new 4-digit parent PIN:");
  if (pin && /^\d{4}$/.test(pin.trim())) { await save({ pinHash: await hashPin(pin.trim()) }); alert("PIN updated."); }
  else if (pin !== null) alert("PIN must be exactly 4 digits.");
};

/* ---------- init ---------- */
(async () => {
  const s = await load();
  if (!s.pinHash) $("pinHint").textContent = "First run: choose a 4-digit parent PIN to set it.";
  renderKid();
})();
