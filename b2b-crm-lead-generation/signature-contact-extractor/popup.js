// Signature Contact Extractor — popup logic.
// scanPage() runs INSIDE the page, so it must stay fully self-contained.

function scanPage() {
  const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const PHONE_RE = /(?:\+\d{1,3}[\s.\-]?)?(?:\(\d{2,4}\)[\s.\-]?|\d{2,5}[\s.\-])\d{3,4}[\s.\-]?\d{3,4}/g;
  const TITLE_RE = /\b(c\.?e\.?o|c\.?t\.?o|c\.?f\.?o|founder|co-?founder|president|v\.?p\.?|vice president|director|manager|head of|team lead|lead|engineer|developer|designer|consultant|specialist|analyst|marketing|sales|recruiter|hr\b|support|owner|partner|executive|assistant|coordinator|strategist|advisor|account|growth|operations|product)\b/i;
  const NAME_RE = /^[A-ZÀ-Ž][a-zà-ž'.\-]+(?: [A-ZÀ-Ž][a-zà-ž'.\-]+){1,3}$/;
  const JUNK = /^(noreply|no-reply|donotreply|mailer-daemon|postmaster)@/i;

  const out = [];
  const seen = new Set();

  function cleanPhone(p) {
    const digits = p.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15 ? digits : null;
  }
  function push(contact) {
    const key = contact.emails[0] || contact.phones[0] || null;
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(contact);
  }

  // 1) signature blocks: leaf-ish elements whose text contains an email
  const blocks = document.querySelectorAll("footer, address, .signature, [class*=signature], div, p, td, li, article, section");
  for (const el of blocks) {
    const text = el.innerText || "";
    if (text.length > 1500) continue; // skip huge containers
    const emails = (text.match(EMAIL_RE) || []).filter((e) => !JUNK.test(e) && !/example\.(com|org|net)$/i.test(e));
    if (!emails.length) continue;
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const emailIdx = lines.findIndex((l) => l.includes(emails[0]));
    let name = null, title = null;
    for (let i = Math.max(0, emailIdx - 3); i < emailIdx; i++) {
      const l = lines[i];
      if (!name && NAME_RE.test(l) && l.length <= 40 && !TITLE_RE.test(l)) name = l;
    }
    for (let i = Math.max(0, emailIdx - 2); i <= Math.min(lines.length - 1, emailIdx + 2); i++) {
      const m = lines[i].match(TITLE_RE);
      if (m && !title) { title = lines[i].length <= 60 ? lines[i] : m[0]; break; }
    }
    const phones = [...new Set((text.match(PHONE_RE) || []).map(cleanPhone).filter(Boolean))];
    const social = [];
    for (const a of el.querySelectorAll("a[href]")) {
      const h = a.href;
      if (/linkedin\.com\/in\//i.test(h) || /(twitter|x)\.com\//i.test(h)) social.push(h.split("?")[0]);
    }
    push({ name, title, emails: [...new Set(emails)], phones, social: [...new Set(social)] });
  }

  // 2) mailto: links anywhere
  for (const a of document.querySelectorAll('a[href^="mailto:"]')) {
    const email = a.href.replace(/^mailto:/i, "").split("?")[0].trim();
    if (!EMAIL_RE.test(email) || JUNK.test(email)) continue;
    const label = (a.innerText || "").trim();
    const contact = { name: null, title: null, emails: [email], phones: [], social: [] };
    if (label && label !== email && NAME_RE.test(label) && label.length <= 40) contact.name = label;
    push(contact);
  }

  // 3) standalone page-wide phones not yet attached to anyone
  const pagePhones = [...new Set(((document.body.innerText || "").match(PHONE_RE) || []).map(cleanPhone).filter(Boolean))];
  const attached = new Set(out.flatMap((c) => c.phones));
  for (const p of pagePhones) {
    if (!attached.has(p)) push({ name: null, title: null, emails: [], phones: [p], social: [] });
  }

  return out.slice(0, 80);
}

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", doScan);
  $("copyAll").addEventListener("click", copyAll);
  $("exportCsv").addEventListener("click", exportCsv);
  $("clearAll").addEventListener("click", async () => {
    await chrome.storage.local.set({ contacts: [] });
    render([]);
  });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  const { contacts = [] } = await chrome.storage.local.get("contacts");
  render(contacts);
}

async function doScan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanPage });
    const found = (res && res.result) || [];
    const { contacts = [] } = await chrome.storage.local.get("contacts");
    const keys = new Set(contacts.map((c) => c.emails[0] || c.phones[0]));
    for (const c of found) {
      const k = c.emails[0] || c.phones[0];
      if (!keys.has(k)) { keys.add(k); contacts.push(c); }
    }
    await chrome.storage.local.set({ contacts: contacts.slice(0, 300) });
    render(contacts);
    toast(found.length ? `Found ${found.length} contact${found.length > 1 ? "s" : ""}` : "No contacts found on this page");
  } catch (e) {
    toast("Couldn’t scan this page (try a normal web page)");
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

function fieldRow(label, value, href) {
  const row = document.createElement("div");
  row.className = "field";
  const k = document.createElement("span"); k.className = "k"; k.textContent = label;
  const v = document.createElement("span"); v.className = "v";
  if (href) { const a = document.createElement("a"); a.href = href; a.textContent = value; a.target = "_blank"; v.appendChild(a); }
  else v.textContent = value;
  const b = document.createElement("button");
  b.className = "mini"; b.textContent = "Copy";
  b.addEventListener("click", () => { navigator.clipboard.writeText(value); toast("Copied"); });
  row.append(k, v, b);
  return row;
}

function render(contacts) {
  const list = $("list");
  list.innerHTML = "";
  $("empty").style.display = contacts.length ? "none" : "";
  $("stats").hidden = contacts.length === 0;
  $("actions").hidden = contacts.length === 0;
  const emails = new Set(), phones = new Set();
  contacts.forEach((c) => { c.emails.forEach((e) => emails.add(e)); c.phones.forEach((p) => phones.add(p)); });
  $("stCount").textContent = contacts.length;
  $("stEmails").textContent = emails.size;
  $("stPhones").textContent = phones.size;

  for (const c of contacts) {
    const card = document.createElement("div");
    card.className = "contact glass";
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = c.name || c.emails[0] || c.phones[0] || "Unknown";
    card.appendChild(nm);
    if (c.title) {
      const t = document.createElement("span");
      t.className = "title"; t.textContent = c.title;
      card.appendChild(t);
    }
    c.emails.forEach((e) => card.appendChild(fieldRow("Email", e, "mailto:" + e)));
    c.phones.forEach((p) => card.appendChild(fieldRow("Phone", "+" + p)));
    c.social.forEach((s) => {
      const label = /linkedin/i.test(s) ? "LinkedIn" : /twitter|x\.com/i.test(s) ? "X/Twitter" : "Social";
      card.appendChild(fieldRow("Social", label, s));
    });
    list.appendChild(card);
  }
}

function toCsv(contacts) {
  const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
  const rows = [["name", "title", "email", "phone", "social"]];
  for (const c of contacts) {
    rows.push([
      c.name || "", c.title || "",
      c.emails.join("; "), c.phones.map((p) => "+" + p).join("; "),
      c.social.join("; "),
    ]);
  }
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

async function getContacts() {
  const { contacts = [] } = await chrome.storage.local.get("contacts");
  return contacts;
}

async function copyAll() {
  const contacts = await getContacts();
  await navigator.clipboard.writeText(toCsv(contacts));
  toast("CSV copied to clipboard");
}

async function exportCsv() {
  const contacts = await getContacts();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([toCsv(contacts)], { type: "text/csv" }));
  a.download = "contacts.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast("CSV downloaded");
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
