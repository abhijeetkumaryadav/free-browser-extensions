// Directory CSV Exporter — popup logic.
// detectPeople() is injected into the viewed page; keep it self-contained
// (no references to popup scope).

function detectPeople() {
  const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const EMAIL_ALL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const PHONE = /(?:\+?\d[\d().\-\s]{7,}\d)/g;

  const out = [];
  const seen = new Set();

  function push(p) {
    const key = [p.email, p.phone, p.name].join("|").toLowerCase();
    if (!key.replace(/\|/g, "").trim()) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      name: (p.name || "").slice(0, 80),
      role: (p.role || "").slice(0, 80),
      email: (p.email || "").slice(0, 120),
      phone: (p.phone || "").slice(0, 40),
    });
  }

  // Walk up to the smallest container that looks like a person card.
  function cardOf(el) {
    let node = el, hops = 0;
    while (node && node !== document.body && hops < 5) {
      node = node.parentElement; hops++;
      const t = node.innerText || "";
      if (t.length > 15 && t.length < 900) return node;
    }
    return el.parentElement || el;
  }

  // Best-effort name + role from the card's text.
  function nameRoleFrom(card, exclude) {
    const lines = (card.innerText || "").split("\n")
      .map((s) => s.trim())
      .filter((s) => s && s.length > 1 && s.length < 80 && !exclude.includes(s)
        && !EMAIL.test(s) && !/^tel:/i.test(s));
    const head = card.querySelector("h1,h2,h3,h4,h5,strong,b,[class*='name' i]");
    let name = head ? head.innerText.trim().split("\n")[0].slice(0, 80) : "";
    if (!name && lines.length) name = lines[0];
    let role = "";
    if (lines.length > 1 && lines[1] !== name) role = lines[1];
    return { name, role };
  }

  function phonesIn(card) {
    return ((card.innerText || "").match(PHONE) || [])
      .map((s) => s.trim())
      .filter((s) => (s.replace(/\D/g, "").length >= 7));
  }

  document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
    const email = a.getAttribute("href").slice(7).split("?")[0].trim();
    if (!EMAIL.test(email)) return;
    const card = cardOf(a);
    const { name, role } = nameRoleFrom(card, [email, a.innerText.trim()]);
    const phones = phonesIn(card);
    push({ name, role, email, phone: phones[0] || "" });
  });

  document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
    const phone = a.getAttribute("href").slice(4).split("?")[0].trim();
    const card = cardOf(a);
    const emails = (card.innerText || "").match(EMAIL_ALL) || [];
    const { name, role } = nameRoleFrom(card, [emails[0] || "", a.innerText.trim(), phone]);
    push({ name, role, email: emails[0] || "", phone });
  });

  return out.slice(0, 500);
}

const $ = (id) => document.getElementById(id);
let contacts = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", scan);
  $("export").addEventListener("click", exportCsv);
  $("copy").addEventListener("click", copyEmails);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  const { lastContacts = [] } = await chrome.storage.local.get("lastContacts");
  if (lastContacts.length) { contacts = lastContacts; render(); }
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: detectPeople,
    });
    contacts = (res && res.result) || [];
    await chrome.storage.local.set({ lastContacts: contacts });
    render();
  } catch (e) {
    // chrome:// pages and the store block injection — say so plainly.
    $("pageHost").textContent = "Can’t scan this page (browser-protected).";
  } finally {
    btn.disabled = false; btn.textContent = "Scan this page";
  }
}

function render() {
  const card = $("resCard");
  card.hidden = contacts.length === 0;
  $("count").textContent = contacts.length;
  const body = $("rows");
  body.innerHTML = "";
  contacts.forEach((c, i) => {
    const tr = document.createElement("tr");
    const cell = (txt, cls) => {
      const td = document.createElement("td");
      td.textContent = txt || "—";
      if (cls) td.className = cls;
      if (!txt) td.classList.add("mut");
      return td;
    };
    tr.append(cell(c.name), cell(c.role), cell(c.email, "mail"), cell(c.phone));
    const xTd = document.createElement("td");
    const x = document.createElement("button");
    x.className = "rowx"; x.textContent = "×"; x.title = "Remove row";
    x.addEventListener("click", async () => {
      contacts.splice(i, 1);
      await chrome.storage.local.set({ lastContacts: contacts });
      render();
    });
    xTd.appendChild(x);
    tr.appendChild(xTd);
    body.appendChild(tr);
  });
}

function csvEsc(v) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

async function exportCsv() {
  if (!contacts.length) return;
  const csv = [["Name", "Role", "Email", "Phone"],
    ...contacts.map((c) => [c.name, c.role, c.email, c.phone]),
  ].map((row) => row.map(csvEsc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "directory-contacts.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function copyEmails() {
  const emails = [...new Set(contacts.map((c) => c.email).filter(Boolean))];
  if (!emails.length) return;
  try {
    await navigator.clipboard.writeText(emails.join("\n"));
    const b = $("copy");
    const t = b.textContent;
    b.textContent = "Copied!";
    setTimeout(() => { b.textContent = t; }, 1500);
  } catch (e) { /* clipboard unavailable */ }
}
