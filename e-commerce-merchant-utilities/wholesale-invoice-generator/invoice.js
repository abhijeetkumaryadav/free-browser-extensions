// Invoice preview page — renders the invoice saved by the popup, then prints.

document.addEventListener("DOMContentLoaded", init);

async function init() {
  document.getElementById("printNow").addEventListener("click", () => window.print());
  const { printInvoice } = await chrome.storage.local.get("printInvoice");
  if (!printInvoice || !printInvoice.items || !printInvoice.items.length) {
    document.querySelector(".sheet").innerHTML =
      "<p style='color:#6b7280'>No invoice data found. Build one in the extension popup first.</p>";
    return;
  }
  render(printInvoice);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function money(n, cur) {
  return cur + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function render(inv) {
  const cur = inv.currency || "₹";
  const set = (id, v) => { document.getElementById(id).textContent = v || "—"; };
  set("iSeller", inv.seller.name);
  set("iSellerAddr", inv.seller.addr);
  set("iSellerContact", inv.seller.phone);
  set("iSellerTax", inv.seller.tax);
  set("iBuyer", inv.buyer.name);
  set("iBuyerAddr", inv.buyer.addr);
  set("iBuyerTax", inv.buyer.tax);
  set("iNum", inv.invNo);
  set("iDate", inv.date);

  const tb = document.getElementById("iRows");
  let sub = 0, tax = 0;
  inv.items.forEach((it, i) => {
    const line = it.qty * it.price;
    const t = line * (it.taxPct / 100);
    sub += line; tax += t;
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td class="c">${i + 1}</td><td>${esc(it.product)}</td>` +
      `<td class="c">${it.qty}</td><td class="r">${money(it.price, cur)}</td>` +
      `<td class="c">${it.taxPct}%</td><td class="r">${money(line + t, cur)}</td>`;
    tb.appendChild(tr);
  });
  set("iSub", money(sub, cur));
  set("iTax", money(tax, cur));
  set("iGrand", money(sub + tax, cur));

  if (inv.notes && inv.notes.trim()) {
    set("iNotes", inv.notes);
  } else {
    document.getElementById("iNotesWrap").style.display = "none";
  }
}
