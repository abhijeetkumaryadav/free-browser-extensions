/* Scam Wallet Checker — popup logic
 * Storage shape: { scamAddrs: [{addr, note, sample}] }
 * Check-only: never modifies pages, never blocks anything. */

const addrEl = document.getElementById("addr");
const resultEl = document.getElementById("result");
const listEl = document.getElementById("list");
const countEl = document.getElementById("count");
const newAddrEl = document.getElementById("newAddr");
const statusEl = document.getElementById("status");

const norm = (s) => s.trim().replace(/\s+/g, "");

// Very loose address shape check (length + charset) — NOT a validator.
function looksLikeAddress(s) {
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return "Ethereum-style";
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(s)) return "Bitcoin-style";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return "Solana-style";
  return null;
}

async function load() {
  const { scamAddrs } = await chrome.storage.local.get("scamAddrs");
  if (!scamAddrs) {
    const seed = (window.SAMPLE_SCAM_ADDRESSES || []).map((e) => ({ ...e }));
    await chrome.storage.local.set({ scamAddrs: seed });
    return seed;
  }
  return scamAddrs;
}

function render(list) {
  countEl.textContent = list.length;
  listEl.innerHTML = "";
  list.forEach((e, i) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "mono";
    span.textContent = e.addr;
    const tag = document.createElement("em");
    tag.textContent = e.sample ? "sample" : "yours";
    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Remove";
    del.addEventListener("click", async () => {
      const l = await load();
      l.splice(i, 1);
      await chrome.storage.local.set({ scamAddrs: l });
      render(l);
    });
    li.append(span, tag, del);
    listEl.appendChild(li);
  });
}

document.getElementById("check").addEventListener("click", async () => {
  const input = norm(addrEl.value);
  resultEl.classList.remove("hidden");
  if (!input) {
    resultEl.className = "result warn";
    resultEl.innerHTML = "<strong>No address entered.</strong><p>Paste an address above to check it.</p>";
    return;
  }
  const kind = looksLikeAddress(input);
  const list = await load();
  const hit = list.find((e) => norm(e.addr).toLowerCase() === input.toLowerCase());
  if (hit) {
    resultEl.className = "result bad";
    resultEl.innerHTML =
      "<strong>⚠ Match found on your list.</strong>" +
      "<p>This address matches an entry" + (hit.note ? ": " + escapeHtml(hit.note) : ".") + "</p>" +
      "<p class='fine'>Do not send funds to it. This tool never blocks anything — the decision is yours.</p>";
  } else {
    resultEl.className = "result " + (kind ? "ok" : "warn");
    resultEl.innerHTML =
      "<strong>" + (kind ? "No match on your list." : "No match — but this doesn't look like a full address.") + "</strong>" +
      (kind ? "<p>Recognized as " + kind + ".</p>" : "<p>Check for typos; an incomplete address can't be matched.</p>") +
      "<p class='fine'>Not being on your list does <em>not</em> mean safe. Scammers use fresh addresses constantly — verify through independent channels before sending anything.</p>";
  }
});

document.getElementById("add").addEventListener("click", async () => {
  const input = norm(newAddrEl.value);
  if (!input) return;
  const list = await load();
  if (list.some((e) => norm(e.addr).toLowerCase() === input.toLowerCase())) {
    statusEl.textContent = "Already on your list.";
    return;
  }
  list.push({ addr: input, note: "Added by you", sample: false });
  await chrome.storage.local.set({ scamAddrs: list });
  newAddrEl.value = "";
  statusEl.textContent = "Added.";
  render(list);
});

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

load().then(render);
