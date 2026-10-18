// Supplier Alternative Finder — popup logic. All on-device; no network.

const $ = (id) => document.getElementById(id);
const MAX_SUPPLIERS = 5;

const LAUNCHERS = {
  alibaba: (q) => "https://www.alibaba.com/trade/search?searchText=" + encodeURIComponent(q),
  mic: (q) => "https://www.made-in-china.com/products-search/hot-china-products/" + encodeURIComponent(q.replace(/\s+/g, "-")) + ".html",
  thomas: (q) => "https://www.thomasnet.com/search.html?what=" + encodeURIComponent(q),
  google: (q) => "https://www.google.com/search?q=" + encodeURIComponent(q + " supplier manufacturer wholesale"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("saveTerms").addEventListener("click", saveTerms);
  $("addBtn").addEventListener("click", addSupplier);
  document.querySelectorAll("[data-site]").forEach((b) =>
    b.addEventListener("click", () => launch(b.dataset.site))
  );
  await render();
}

async function getState() {
  const s = await chrome.storage.local.get(["terms", "suppliers"]);
  return {
    terms: s.terms || { product: "", cost: "", moq: "", lead: "", supplier: "" },
    suppliers: s.suppliers || [],
  };
}

async function saveTerms() {
  const terms = {
    product: $("fProduct").value.trim(),
    cost: $("fCost").value,
    moq: $("fMoq").value,
    lead: $("fLead").value,
    supplier: $("fSupplier").value.trim(),
  };
  await chrome.storage.local.set({ terms });
  const btn = $("saveTerms");
  const orig = btn.textContent;
  btn.textContent = "Saved ✓";
  setTimeout(() => { btn.textContent = orig; }, 1200);
}

async function launch(site) {
  const { terms } = await getState();
  const q = terms.product || $("fProduct").value.trim();
  if (!q) { $("fProduct").focus(); return; }
  chrome.tabs.create({ url: LAUNCHERS[site](q) });
}

async function addSupplier() {
  const name = $("nName").value.trim();
  if (!name) { $("nName").focus(); return; }
  const { suppliers } = await getState();
  if (suppliers.length >= MAX_SUPPLIERS) return;
  suppliers.push({
    id: "s-" + Date.now(),
    name,
    cost: parseFloat($("nCost").value) || null,
    moq: parseInt($("nMoq").value, 10) || null,
    lead: parseInt($("nLead").value, 10) || null,
    note: $("nNote").value.trim(),
  });
  await chrome.storage.local.set({ suppliers });
  ["nName", "nCost", "nMoq", "nLead", "nNote"].forEach((id) => { $(id).value = ""; });
  render();
}

function bestClass(values, v, invert) {
  // invert=true: lower is better (cost, moq, lead)
  const nums = values.filter((x) => x != null);
  if (v == null || !nums.length) return "";
  const best = invert ? Math.min(...nums) : Math.max(...nums);
  return v === best && nums.length > 1 ? "best" : "";
}

async function render() {
  const { terms, suppliers } = await getState();
  $("fProduct").value = terms.product || "";
  $("fCost").value = terms.cost || "";
  $("fMoq").value = terms.moq || "";
  $("fLead").value = terms.lead || "";
  $("fSupplier").value = terms.supplier || "";

  $("count").textContent = `(${suppliers.length}/${MAX_SUPPLIERS})`;

  const box = $("rows");
  box.innerHTML = "";
  if (!suppliers.length) {
    const d = document.createElement("div");
    d.className = "empty-supp";
    d.textContent = "No alternatives yet — add suppliers you find via the launchers.";
    box.appendChild(d);
    return;
  }
  const costs = suppliers.map((s) => s.cost);
  const moqs = suppliers.map((s) => s.moq);
  const leads = suppliers.map((s) => s.lead);
  for (const s of suppliers) {
    const card = document.createElement("div");
    card.className = "supp";
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = s.name;
    const vals = document.createElement("div");
    vals.className = "vals";
    const cell = (label, val, cls) => {
      const d = document.createElement("div");
      const b = document.createElement("b");
      b.textContent = val == null ? "—" : val;
      if (cls) b.className = cls;
      const l = document.createElement("span");
      l.textContent = label;
      d.append(b, l);
      return d;
    };
    vals.append(
      cell("Unit cost", s.cost == null ? null : "$" + s.cost.toFixed(2), bestClass(costs, s.cost, true)),
      cell("MOQ", s.moq == null ? null : s.moq.toLocaleString(), bestClass(moqs, s.moq, true)),
      cell("Lead days", s.lead, bestClass(leads, s.lead, true)),
    );
    card.append(nm, vals);
    if (s.note) {
      const n = document.createElement("div");
      n.className = "note-l";
      n.textContent = s.note;
      card.appendChild(n);
    }
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const cur = await getState();
      await chrome.storage.local.set({ suppliers: cur.suppliers.filter((i) => i.id !== s.id) });
      render();
    });
    card.appendChild(x);
    box.appendChild(card);
  }
}
