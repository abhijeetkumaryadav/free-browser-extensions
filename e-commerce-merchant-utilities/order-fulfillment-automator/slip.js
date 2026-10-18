// Packing slip page — reads ?id=, renders a printable slip.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("printBtn").addEventListener("click", () => window.print());
  const id = new URLSearchParams(location.search).get("id");
  const { orders = [] } = await chrome.storage.local.get("orders");
  const o = orders.find((x) => x.id === id);
  const box = $("slip");
  if (!o) {
    box.innerHTML = "<p>Order not found. It may have been deleted.</p>";
    return;
  }
  // Split items like "2x Tee; 1x Mug" into rows.
  const rows = o.items
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(\d+)\s*[x×]\s*(.+)$/i);
      return m ? { qty: m[1], name: m[2] } : { qty: "1", name: s };
    });
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  box.innerHTML = `
    <h1>Packing Slip</h1>
    <div class="meta">Order #${esc(o.orderId)} · ${esc(new Date(o.addedAt).toLocaleString())} · Status: ${esc(o.status.toUpperCase())}</div>
    <h2>Ship to</h2>
    <div class="addr"><strong>${esc(o.customer)}</strong><br>${esc(o.address) || "—"}</div>
    <h2>Items (${rows.length})</h2>
    <table>
      <tr><th>Qty</th><th>Item</th><th>☐ Picked</th></tr>
      ${rows.map((r) => `<tr><td>${esc(r.qty)}</td><td>${esc(r.name)}</td><td>☐</td></tr>`).join("")}
    </table>`;
}
