/* Insurance Jargon Decoder — personal glossary of health-insurance terms.
   Plain-language definitions only; never insurance advice. All local. */

/** Bundled built-in terms (read-only). */
const BUILTINS = [
  ["Premium","The amount you pay each month just to keep your insurance plan active, whether or not you use any care."],
  ["Deductible","The amount you must pay out of your own pocket for covered care each year before your plan starts paying its share."],
  ["Copayment (copay)","A fixed fee you pay for a specific service, like a doctor visit or a prescription, usually due at the time of the visit."],
  ["Coinsurance","After you meet your deductible, this is your percentage share of a covered bill — e.g. 20% coinsurance means you pay 20% and the plan pays 80%."],
  ["Out-of-pocket maximum","The most you will have to pay for covered services in a year. Once you hit it, the plan pays 100% of covered care for the rest of the year."],
  ["Prior authorization","Permission your insurer must give before you get certain treatments or drugs. Without it, the plan may refuse to pay."],
  ["In-network","Doctors, hospitals, and pharmacies that have a contract with your plan. Care here costs you the least."],
  ["Out-of-network","Providers with no contract with your plan. You usually pay much more, and some services may not be covered at all."],
  ["Formulary","Your plan's list of covered prescription drugs, often grouped into tiers that decide how much you pay."],
  ["Explanation of Benefits (EOB)","A statement from your insurer showing what a provider billed, what the plan paid, and what you may owe. It is not a bill."],
  ["PPO","Preferred Provider Organization: a plan type that lets you see specialists without referrals and covers some out-of-network care."],
  ["HMO","Health Maintenance Organization: a plan type that usually requires a primary-care doctor and referrals, and rarely covers out-of-network care."],
  ["HSA","Health Savings Account: a tax-advantaged savings account for medical costs, available with high-deductible plans. The money is yours to keep."],
  ["FSA","Flexible Spending Account: a tax-advantaged account for medical costs funded from your paycheck; use-it-or-lose-it rules often apply."],
  ["Referral","Written approval from your primary-care doctor to see a specialist, required by many HMO-style plans."],
  ["Open enrollment","The yearly window when you can sign up for, change, or drop your health plan. Outside it you generally cannot change plans."],
  ["Special enrollment period","A window to change plans outside open enrollment, triggered by life events like marriage, a new baby, or job loss."],
  ["Preventive care","Routine services meant to catch problems early — vaccines, screenings, checkups — usually covered with no cost-sharing."],
  ["Balance billing","When an out-of-network provider bills you for the difference between their charge and what your plan paid."],
  ["Claim","A formal request sent to your insurer (usually by your provider) asking the plan to pay for a service."],
  ["Appeal","A request to your insurer to reconsider a denied claim. You can usually appeal more than once."],
  ["Grace period","Extra time after a missed premium payment before your coverage is cancelled — typically 30 days, longer with subsidies."],
  ["Waiting period","Time you must wait after enrolling before certain coverage starts (for example, before some dental benefits kick in)."],
  ["Exclusion","A service or condition your plan does not cover at all, listed in your plan documents."],
  ["Rider","An add-on to a policy that covers something the base plan excludes, usually for an extra cost."],
  ["Dependent","A family member (spouse, child) covered under your plan rather than their own."],
  ["Emergency services","Care for sudden, serious conditions. Most plans cover true emergencies even out-of-network."],
  ["Telehealth","Medical visits by phone or video. Coverage varies by plan and service type."],
  ["Annual limit","A cap on what a plan pays for certain benefits in a year. Banned for essential benefits under many current rules."],
  ["Catastrophic plan","A low-premium, high-deductible plan for young adults or those with hardship exemptions; covers worst-case scenarios."],
];

/** Storage key for user-added terms. */
const KEY = "userTerms";

/** @type {{term:string, def:string}[]} user terms */
let userTerms = [];
/** id of the term being edited, or null */
let editingId = null;
/** current search query */
let query = "";

const $ = (id) => document.getElementById(id);

/** Load user terms from storage. */
async function load() {
  const data = await chrome.storage.local.get(KEY);
  userTerms = Array.isArray(data[KEY]) ? data[KEY] : [];
}

/** Save user terms to storage. */
function save() {
  return chrome.storage.local.set({ [KEY]: userTerms });
}

/** All terms: builtins (marked) + user terms, filtered by search. */
function allTerms() {
  const q = query.trim().toLowerCase();
  const built = BUILTINS.map(([term, def]) => ({ term, def, builtin: true, id: "b:" + term }));
  const mine = userTerms.map((t, i) => ({ ...t, builtin: false, id: "u:" + i }));
  const all = [...mine, ...built];
  if (!q) return all;
  return all.filter(t => t.term.toLowerCase().includes(q) || t.def.toLowerCase().includes(q));
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Render the term list. */
function render() {
  const list = $("termList");
  const terms = allTerms();
  $("count").textContent = `${userTerms.length + BUILTINS.length} terms`;
  $("emptyState").classList.toggle("hidden", terms.length > 0);
  list.innerHTML = terms.map(t => `
    <div class="term-card">
      <div class="term-head">
        <h3>${escapeHtml(t.term)}</h3>
        ${t.builtin
          ? `<span class="badge">built-in</span>`
          : `<div class="term-actions">
               <button data-edit="${t.id}" title="Edit">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
               </button>
               <button data-del="${t.id}" class="delete" title="Delete">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
               </button>
             </div>`}
      </div>
      <p class="term-def">${escapeHtml(t.def)}</p>
    </div>`).join("");

  list.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => startEdit(b.dataset.edit)));
  list.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => deleteTerm(b.dataset.del)));
}

/** Start editing a user term. */
function startEdit(id) {
  const idx = Number(id.slice(2));
  const t = userTerms[idx];
  if (!t) return;
  editingId = idx;
  $("termInput").value = t.term;
  $("defInput").value = t.def;
  $("saveBtn").textContent = "Save changes";
  $("cancelEdit").classList.remove("hidden");
  $("termInput").focus();
}

/** Cancel edit mode. */
function cancelEdit() {
  editingId = null;
  $("termForm").reset();
  $("saveBtn").textContent = "Add term";
  $("cancelEdit").classList.add("hidden");
}

/** Delete a user term. */
async function deleteTerm(id) {
  const idx = Number(id.slice(2));
  userTerms.splice(idx, 1);
  if (editingId === idx) cancelEdit();
  else if (editingId !== null && editingId > idx) editingId--;
  await save();
  render();
}

/** Add or save a user term. */
async function handleSubmit(e) {
  e.preventDefault();
  const term = $("termInput").value.trim();
  const def = $("defInput").value.trim();
  if (!term || !def) return;
  if (editingId !== null) {
    userTerms[editingId] = { term, def };
  } else {
    userTerms.push({ term, def });
  }
  await save();
  cancelEdit();
  render();
}

document.addEventListener("DOMContentLoaded", async () => {
  await load();
  render();

  $("termForm").addEventListener("submit", handleSubmit);
  $("cancelEdit").addEventListener("click", cancelEdit);

  const search = $("search");
  search.addEventListener("input", () => {
    query = search.value;
    $("clearSearch").classList.toggle("hidden", !search.value);
    render();
  });
  $("clearSearch").addEventListener("click", () => {
    search.value = "";
    query = "";
    $("clearSearch").classList.add("hidden");
    render();
  });
});
