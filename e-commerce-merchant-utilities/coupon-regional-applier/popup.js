// Coupon Regional Applier — popup logic.
// applyCodeOnPage() is injected into the checkout page; keep it self-contained.

function applyCodeOnPage(code) {
  const INPUT_SELECTORS = [
    'input[name*="coupon" i]',
    'input[name*="promo" i]',
    'input[name*="voucher" i]',
    'input[name*="discount" i]',
    'input[id*="coupon" i]',
    'input[id*="promo" i]',
    'input[placeholder*="coupon" i]',
    'input[placeholder*="promo" i]',
    'input[placeholder*="discount" i]',
    'input[aria-label*="coupon" i]',
    'input[aria-label*="promo" i]',
  ];
  let input = null;
  for (const sel of INPUT_SELECTORS) {
    try {
      input = document.querySelector(sel);
      if (input && input.offsetParent !== null) break;
      input = null;
    } catch (e) { /* bad selector on odd pages */ }
  }
  if (!input) return { ok: false, reason: "no-field" };
  try {
    input.focus();
    // React-controlled inputs need the native setter trick
    const native = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value"
    ).set;
    native.call(input, code);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (e) {
    input.value = code;
  }
  // find the apply button near the input
  let btn = null;
  const scope = input.closest("form") || input.parentElement;
  if (scope) {
    const candidates = scope.querySelectorAll("button, input[type=submit], input[type=button]");
    for (const c of candidates) {
      const t = (c.textContent || c.value || "").toLowerCase();
      if (/apply|redeem|submit|add|ok/.test(t)) { btn = c; break; }
    }
  }
  if (!btn) {
    const all = document.querySelectorAll("button");
    for (const c of all) {
      const t = (c.textContent || "").toLowerCase().trim();
      if (/^(apply|redeem)(\s+code|\s+coupon)?$/.test(t)) { btn = c; break; }
    }
  }
  if (btn) {
    btn.click();
    return { ok: true, clicked: true };
  }
  // field filled, but no apply button found — user can submit manually
  return { ok: true, clicked: false };
}

const $ = (id) => document.getElementById(id);
let activeRegion = "All";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("applyBtn").addEventListener("click", tryApply);
  $("tryCode").addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryApply();
  });
  $("addBtn").addEventListener("click", addCoupon);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  renderVault();
}

function setStatus(msg, cls) {
  const el = $("tryStatus");
  el.textContent = msg || "";
  el.className = "status" + (cls ? " " + cls : "");
}

async function tryApply() {
  const code = $("tryCode").value.trim();
  if (!code) { setStatus("Type a code first.", "err"); return; }
  const btn = $("applyBtn");
  btn.disabled = true;
  setStatus("Applying…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applyCodeOnPage,
      args: [code.toUpperCase()],
    });
    const r = res && res.result;
    if (!r || !r.ok) {
      setStatus("No coupon field found on this page. Try the cart or checkout step.", "err");
    } else if (r.clicked) {
      setStatus(`“${code.toUpperCase()}” applied — check the total.`, "ok");
    } else {
      setStatus("Code filled in — hit the page’s apply button to finish.", "ok");
    }
  } catch (e) {
    setStatus("Can’t run on this page — try a regular store checkout.", "err");
  } finally {
    btn.disabled = false;
  }
}

async function getVault() {
  const { coupons = [] } = await chrome.storage.local.get("coupons");
  return coupons;
}

async function addCoupon() {
  const code = $("newCode").value.trim().toUpperCase();
  if (!code) return;
  const coupons = await getVault();
  coupons.unshift({
    id: "cpn-" + Date.now(),
    code,
    merchant: $("newMerchant").value.trim() || "Any store",
    region: $("newRegion").value.trim().toUpperCase() || "GLOBAL",
    addedAt: Date.now(),
  });
  await chrome.storage.local.set({ coupons: coupons.slice(0, 100) });
  $("newCode").value = $("newMerchant").value = $("newRegion").value = "";
  renderVault();
}

async function renderVault() {
  const coupons = await getVault();
  const regions = ["All", ...new Set(coupons.map((c) => c.region))];
  const chips = $("regionChips");
  chips.innerHTML = "";
  for (const r of regions) {
    const b = document.createElement("button");
    b.textContent = r;
    b.className = r === activeRegion ? "active" : "";
    b.addEventListener("click", () => { activeRegion = r; renderVault(); });
    chips.appendChild(b);
  }
  const box = $("vault");
  box.innerHTML = "";
  const shown = coupons.filter((c) => activeRegion === "All" || c.region === activeRegion);
  if (!shown.length) {
    const d = document.createElement("div");
    d.className = "empty-vault";
    d.textContent = "No coupons saved yet. Add your first one below.";
    box.appendChild(d);
    return;
  }
  for (const c of shown) {
    const row = document.createElement("div");
    row.className = "coupon";
    const code = document.createElement("div");
    code.className = "code";
    code.textContent = c.code;
    const meta = document.createElement("div");
    meta.className = "meta";
    const b = document.createElement("b");
    b.textContent = c.merchant;
    const s = document.createElement("span");
    s.textContent = c.region;
    meta.append(b, s);
    const acts = document.createElement("div");
    acts.className = "acts";
    const copy = document.createElement("button");
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(c.code); }
      catch (e) {
        const ta = document.createElement("textarea");
        ta.value = c.code; document.body.appendChild(ta);
        ta.select(); document.execCommand("copy"); ta.remove();
      }
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1200);
    });
    const use = document.createElement("button");
    use.className = "use";
    use.textContent = "Apply";
    use.addEventListener("click", async () => {
      $("tryCode").value = c.code;
      await tryApply();
    });
    const del = document.createElement("button");
    del.textContent = "×";
    del.addEventListener("click", async () => {
      const cur = await getVault();
      await chrome.storage.local.set({ coupons: cur.filter((x) => x.id !== c.id) });
      renderVault();
    });
    acts.append(copy, use, del);
    row.append(code, meta, acts);
    box.appendChild(row);
  }
}
