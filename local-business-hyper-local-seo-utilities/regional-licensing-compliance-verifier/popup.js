/* LicenseLens — compliance assistant logic. All data stays on-device. */
"use strict";

/* ---------- Curated directory of official licensing authorities ---------- */
const DIRECTORY = [
  { name: "US Small Business — Licenses & Permits", region: "United States", category: "Business", url: "https://www.sba.gov/business-guide/launch-your-business/apply-for-licenses-permits", note: "Federal + state license finder for new businesses." },
  { name: "FCC Licensing", region: "United States", category: "Media & Broadcasting", url: "https://www.fcc.gov/licensing", note: "Broadcast, wireless and telecom licenses." },
  { name: "FDA — Industry Guidance", region: "United States", category: "Healthcare", url: "https://www.fda.gov/industry", note: "Food, drug and medical-device approvals." },
  { name: "California CCPA (OAG)", region: "United States", category: "Data & Privacy", url: "https://oag.ca.gov/privacy/ccpa", note: "California consumer privacy compliance." },
  { name: "UK Government — Licence Finder", region: "United Kingdom", category: "Business", url: "https://www.gov.uk/licence-finder", note: "Find licences for your business activity." },
  { name: "EU — CE Marking", region: "European Union", category: "Business", url: "https://single-market-economy.ec.europa.eu/single-market/ce-marking_en", note: "Product conformity marking for the EU market." },
  { name: "EU — GDPR Portal", region: "European Union", category: "Data & Privacy", url: "https://gdpr.eu", note: "Complete guide to GDPR compliance." },
  { name: "FSSAI — Food Licensing", region: "India", category: "Food & Beverage", url: "https://www.fssai.gov.in", note: "Food safety licences and FSSAI registration." },
  { name: "GST Portal India", region: "India", category: "Business", url: "https://www.gst.gov.in", note: "GST registration and compliance filings." },
  { name: "Shop & Establishment (by state)", region: "India", category: "Business", url: "https://www.mca.gov.in", note: "Company and establishment registrations via MCA." },
  { name: "Canada — Business Start & Permits", region: "Canada", category: "Business", url: "https://www.canada.ca/en/services/business/start.html", note: "Federal permits and provincial licences." },
  { name: "Australia — ABLIS Licence Search", region: "Australia", category: "Business", url: "https://business.gov.au/registrations", note: "Australian Business Licence & Information Service." },
  { name: "Singapore — GoBusiness Licensing", region: "Singapore", category: "Business", url: "https://www.gobusiness.gov.sg", note: "One-stop portal for business licences." },
  { name: "MAS — Financial Licensing", region: "Singapore", category: "Finance", url: "https://www.mas.gov.sg", note: "Monetary Authority licensing for finance." },
];

/* Default checklist applied to every tracked license */
const DEFAULT_STEPS = [
  "Confirm which licence applies to your activity",
  "Gather required documents",
  "Complete the application form",
  "Pay the application fee",
  "Submit the application",
  "Track approval status",
  "Store the issued licence securely",
  "Schedule the renewal reminder",
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const daysUntil = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso + "T23:59:59") - Date.now();
  return Math.ceil(ms / 86400000);
};

/* ------------------------------ Storage ------------------------------ */
async function getLicenses() {
  const { licenses = [] } = await chrome.storage.local.get("licenses");
  return licenses;
}
async function saveLicenses(licenses) {
  await chrome.storage.local.set({ licenses });
  await chrome.runtime.sendMessage({ type: "reschedule" }).catch(() => {});
}

/* ------------------------------ Tabs ------------------------------ */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.add("active");
  });
});

/* ------------------------------ Directory ------------------------------ */
function renderDirectory() {
  const q = $("dirSearch").value.trim().toLowerCase();
  const region = $("dirRegion").value;
  const category = $("dirCategory").value;
  const list = DIRECTORY.filter((d) =>
    (!q || (d.name + d.note).toLowerCase().includes(q)) &&
    (!region || d.region === region) &&
    (!category || d.category === category)
  );
  $("directoryList").innerHTML = list.length
    ? list.map((d) => `
      <div class="card">
        <h4>${esc(d.name)}</h4>
        <div class="meta">${esc(d.region)} · ${esc(d.category)}</div>
        <p class="note">${esc(d.note)}</p>
        <a class="link" href="${esc(d.url)}" target="_blank" rel="noopener">Open official site
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M7 7h10v10"/></svg>
        </a>
      </div>`).join("")
    : `<div class="empty">No authorities match your filters.</div>`;
}

function initDirectoryFilters() {
  const regions = [...new Set(DIRECTORY.map((d) => d.region))].sort();
  const cats = [...new Set(DIRECTORY.map((d) => d.category))].sort();
  regions.forEach((r) => $("dirRegion").insertAdjacentHTML("beforeend", `<option>${esc(r)}</option>`));
  cats.forEach((c) => $("dirCategory").insertAdjacentHTML("beforeend", `<option>${esc(c)}</option>`));
  ["dirSearch", "dirRegion", "dirCategory"].forEach((id) =>
    $(id).addEventListener("input", renderDirectory));
  // Authority select for the license form
  $("fAuthority").innerHTML = DIRECTORY.map((d) => `<option>${esc(d.name)}</option>`).join("") +
    `<option>Other / custom</option>`;
}

/* ------------------------------ Licenses ------------------------------ */
function expiryBadge(lic) {
  const d = daysUntil(lic.expiry);
  if (d === null) return `<span class="badge info">No expiry set</span>`;
  if (d < 0) return `<span class="badge danger">Expired ${-d}d ago</span>`;
  if (d === 0) return `<span class="badge danger">Expires today</span>`;
  if (d <= 7) return `<span class="badge danger">${d}d left</span>`;
  if (d <= 30) return `<span class="badge warn">${d}d left</span>`;
  return `<span class="badge ok">${d}d left</span>`;
}

async function renderLicenses() {
  const licenses = await getLicenses();
  $("licenseCount").textContent = licenses.length || "";
  $("licenseList").innerHTML = licenses.length
    ? licenses.map((lic) => {
        const done = lic.checklist.filter((s) => s.done).length;
        const pct = Math.round((done / lic.checklist.length) * 100);
        return `
        <div class="card" data-id="${lic.id}">
          <div class="card-head">
            <div>
              <h4>${esc(lic.name)}</h4>
              <div class="meta">${esc(lic.authority)}</div>
            </div>
            <button class="icon-btn" data-action="delete" title="Delete">✕</button>
          </div>
          <div>${expiryBadge(lic)}</div>
          <div class="progress"><div style="width:${pct}%"></div></div>
          <div class="prog-label">${done}/${lic.checklist.length} steps complete</div>
          <ul class="checklist">
            ${lic.checklist.map((s, i) => `
              <li class="${s.done ? "done" : ""}">
                <input type="checkbox" data-action="toggle" data-i="${i}" ${s.done ? "checked" : ""}>
                <span>${esc(s.text)}</span>
              </li>`).join("")}
          </ul>
          ${lic.notes ? `<p class="note" style="margin-top:8px">📝 ${esc(lic.notes)}</p>` : ""}
        </div>`;
      }).join("")
    : `<div class="empty">No licences tracked yet.<br>Tap “Track a new license” to start your compliance checklist.</div>`;
}

$("licenseList").addEventListener("change", async (e) => {
  const action = e.target.dataset.action;
  if (action !== "toggle") return;
  const card = e.target.closest(".card");
  const licenses = await getLicenses();
  const lic = licenses.find((l) => l.id === card.dataset.id);
  if (!lic) return;
  lic.checklist[+e.target.dataset.i].done = e.target.checked;
  await saveLicenses(licenses);
  renderLicenses();
});

$("licenseList").addEventListener("click", async (e) => {
  if (e.target.dataset.action !== "delete") return;
  if (!confirm("Delete this tracked license?")) return;
  const card = e.target.closest(".card");
  const licenses = await getLicenses();
  await saveLicenses(licenses.filter((l) => l.id !== card.dataset.id));
  renderLicenses();
  renderReminders();
});

$("addLicenseBtn").addEventListener("click", () => $("licenseForm").classList.remove("hidden"));
$("cancelForm").addEventListener("click", () => $("licenseForm").classList.add("hidden"));

$("licenseForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const licenses = await getLicenses();
  licenses.unshift({
    id: uid(),
    name: $("fName").value.trim(),
    authority: $("fAuthority").value,
    issued: $("fIssued").value || null,
    expiry: $("fExpiry").value || null,
    notes: $("fNotes").value.trim(),
    checklist: DEFAULT_STEPS.map((t) => ({ text: t, done: false })),
    createdAt: Date.now(),
  });
  await saveLicenses(licenses);
  e.target.reset();
  $("licenseForm").classList.add("hidden");
  renderLicenses();
  renderReminders();
});

/* ------------------------------ Reminders ------------------------------ */
async function renderReminders() {
  const licenses = (await getLicenses()).filter((l) => l.expiry);
  licenses.sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));
  $("reminderList").innerHTML = licenses.length
    ? licenses.map((lic) => `
      <div class="card">
        <div class="card-head">
          <div><h4>${esc(lic.name)}</h4><div class="meta">${esc(lic.authority)}</div></div>
          ${expiryBadge(lic)}
        </div>
        <div class="meta">Expires ${esc(lic.expiry)}</div>
      </div>`).join("")
    : `<div class="empty">Add a license with an expiry date<br>to get renewal reminders here.</div>`;
}

/* ------------------------------ Init ------------------------------ */
initDirectoryFilters();
renderDirectory();
renderLicenses();
renderReminders();
