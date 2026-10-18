// Jurisdiction Tax Mapper — popup logic. All on-device; rates are samples.

const SAMPLE_RATES = [
  { country: "India", region: "GST 5% slab", rate: 5 },
  { country: "India", region: "GST 12% slab", rate: 12 },
  { country: "India", region: "GST 18% slab", rate: 18 },
  { country: "India", region: "GST 28% slab", rate: 28 },
  { country: "United States", region: "California", rate: 7.25 },
  { country: "United States", region: "New York", rate: 8.0 },
  { country: "United States", region: "Texas", rate: 6.25 },
  { country: "United Kingdom", region: "Standard VAT", rate: 20 },
  { country: "Germany", region: "Standard VAT", rate: 19 },
  { country: "France", region: "Standard VAT", rate: 20 },
  { country: "UAE", region: "Standard VAT", rate: 5 },
  { country: "Singapore", region: "GST", rate: 9 },
];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("amount").addEventListener("input", calculate);
  $("juris").addEventListener("change", calculate);
  $("inclusive").addEventListener("change", calculate);
  $("addBtn").addEventListener("click", addRate);
  await renderJuris();
  renderRates();
}

async function allRates() {
  const { customRates = [] } = await chrome.storage.local.get("customRates");
  return [...SAMPLE_RATES.map((r, i) => ({ ...r, id: "sample-" + i, sample: true })), ...customRates];
}

async function renderJuris() {
  const rates = await allRates();
  const sel = $("juris");
  sel.innerHTML = "";
  let lastCountry = null;
  const sorted = [...rates].sort((a, b) =>
    (a.country + a.region).localeCompare(b.country + b.region)
  );
  for (const r of sorted) {
    if (r.country !== lastCountry) {
      const g = document.createElement("optgroup");
      g.label = r.country;
      sel.appendChild(g);
      lastCountry = r.country;
    }
    const o = document.createElement("option");
    o.value = r.id;
    o.textContent = `${r.region} — ${r.rate}%`;
    sel.lastChild.appendChild(o);
  }
  calculate();
}

async function calculate() {
  const amount = parseFloat($("amount").value) || 0;
  const rates = await allRates();
  const r = rates.find((x) => x.id === $("juris").value) || rates[0];
  const box = $("result");
  if (!amount || !r) { box.hidden = true; return; }
  box.hidden = false;
  let base, tax, total;
  if ($("inclusive").checked) {
    total = amount;
    base = total / (1 + r.rate / 100);
    tax = total - base;
  } else {
    base = amount;
    tax = base * (r.rate / 100);
    total = base + tax;
  }
  const f = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $("rBase").textContent = f(base);
  $("rRate").textContent = r.rate + "%";
  $("rTax").textContent = f(tax);
  $("rTotal").textContent = f(total);
}

async function addRate() {
  const country = $("nCountry").value.trim();
  const region = $("nRegion").value.trim();
  const rate = parseFloat($("nRate").value);
  if (!country || !region || isNaN(rate) || rate < 0 || rate > 100) return;
  const { customRates = [] } = await chrome.storage.local.get("customRates");
  customRates.push({ id: "custom-" + Date.now(), country, region, rate });
  await chrome.storage.local.set({ customRates });
  $("nCountry").value = $("nRegion").value = $("nRate").value = "";
  await renderJuris();
  renderRates();
}

async function renderRates() {
  const rates = await allRates();
  const box = $("rates");
  box.innerHTML = "";
  const sorted = [...rates].sort((a, b) =>
    (a.country + a.region).localeCompare(b.country + b.region)
  );
  for (const r of sorted) {
    const row = document.createElement("div");
    row.className = "rate-row";
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.innerHTML = `<b style="font-size:12px">${esc(r.region)}</b><span>${esc(r.country)}${r.sample ? " · sample" : ""}</span>`;
    const b = document.createElement("b");
    b.textContent = r.rate + "%";
    row.append(nm, b);
    if (!r.sample) {
      const x = document.createElement("button");
      x.className = "x"; x.textContent = "×";
      x.addEventListener("click", async () => {
        const { customRates = [] } = await chrome.storage.local.get("customRates");
        await chrome.storage.local.set({ customRates: customRates.filter((c) => c.id !== r.id) });
        await renderJuris();
        renderRates();
      });
      row.appendChild(x);
    }
    box.appendChild(row);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
