// LinkedIn Notion Lead Pusher — leads stay on-device; the webhook only
// fires when the user presses the button, and only to their own URL.

const $ = (id) => document.getElementById(id);

// Runs in the page context when the user presses "prefill". Reads public
// meta tags only.
function scrapePage() {
  function meta(sel) {
    const el = document.querySelector(sel);
    return el ? el.getAttribute("content") : null;
  }
  return {
    title: meta('meta[property="og:title"]') || document.title || "",
    desc: meta('meta[property="og:description"]') || meta('meta[name="description"]') || "",
    url: location.href,
  };
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("grab").addEventListener("click", prefill);
  $("saveBtn").addEventListener("click", saveLead);
  $("copyMd").addEventListener("click", copyMarkdown);
  $("dlCsv").addEventListener("click", downloadCsv);
  $("pushBtn").addEventListener("click", pushWebhook);
  $("webhook").addEventListener("change", async () => {
    await chrome.storage.local.set({ webhookUrl: $("webhook").value.trim() });
  });
  const { webhookUrl = "" } = await chrome.storage.local.get("webhookUrl");
  $("webhook").value = webhookUrl;
  render();
}

async function getLeads() {
  const { leads = [] } = await chrome.storage.local.get("leads");
  return leads;
}
async function setLeads(leads) { await chrome.storage.local.set({ leads }); }

async function prefill() {
  const hint = $("grabHint");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapePage });
    const d = res && res.result;
    if (!d) throw new Error("no-data");
    // Heuristic: "Name | Headline" or "Name - Headline"
    const parts = d.title.split(/\s*[|\-–—]\s*/);
    if (!$("fName").value && parts[0]) $("fName").value = parts[0].slice(0, 80);
    if (!$("fHeadline").value && parts[1]) $("fHeadline").value = parts[1].slice(0, 120);
    if (!$("fHeadline").value && d.desc) $("fHeadline").value = d.desc.slice(0, 120);
    if (!$("fUrl").value) $("fUrl").value = d.url;
    hint.textContent = "· prefilled from this page";
    setTimeout(() => { hint.textContent = ""; }, 2500);
  } catch (e) {
    hint.textContent = "· couldn’t read this page";
    setTimeout(() => { hint.textContent = ""; }, 2500);
  }
}

async function saveLead() {
  const name = $("fName").value.trim();
  if (!name) { $("fName").focus(); return; }
  const lead = {
    id: "lead-" + Date.now(),
    name,
    headline: $("fHeadline").value.trim(),
    company: $("fCompany").value.trim(),
    url: $("fUrl").value.trim(),
    tags: $("fTags").value.split(",").map((t) => t.trim()).filter(Boolean),
    notes: $("fNotes").value.trim(),
    created: Date.now(),
  };
  const leads = await getLeads();
  leads.unshift(lead);
  await setLeads(leads.slice(0, 500));
  $("fName").value = $("fHeadline").value = $("fCompany").value =
    $("fUrl").value = $("fTags").value = $("fNotes").value = "";
  render();
}

async function render() {
  const leads = await getLeads();
  const card = $("leadsCard"), box = $("leads");
  box.innerHTML = "";
  card.hidden = leads.length === 0;
  $("leadCount").textContent = leads.length ? `· ${leads.length}` : "";
  for (const l of leads) {
    const el = document.createElement("div");
    el.className = "lead";
    const hd = document.createElement("div");
    hd.className = "hd";
    const b = document.createElement("b"); b.textContent = l.name;
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Delete lead";
    x.addEventListener("click", async () => {
      await setLeads((await getLeads()).filter((i) => i.id !== l.id));
      render();
    });
    hd.append(b, x);
    el.appendChild(hd);
    const sub = [l.headline, l.company].filter(Boolean).join(" · ");
    if (sub) { const s = document.createElement("div"); s.className = "sub"; s.textContent = sub; el.appendChild(s); }
    if (l.url) {
      const a = document.createElement("a");
      a.className = "lnk"; a.href = l.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = shortUrl(l.url);
      el.appendChild(a);
    }
    if (l.notes) { const n = document.createElement("p"); n.className = "nts"; n.textContent = l.notes; el.appendChild(n); }
    if (l.tags.length) {
      const tg = document.createElement("div");
      tg.className = "tags";
      for (const t of l.tags) {
        const c = document.createElement("span");
        c.className = "tag"; c.textContent = "#" + t;
        tg.appendChild(c);
      }
      el.appendChild(tg);
    }
    box.appendChild(el);
  }
}

function shortUrl(u) {
  try { const x = new URL(u); return x.hostname.replace(/^www\./, "") + x.pathname.slice(0, 40); }
  catch (e) { return u.slice(0, 60); }
}

// Notion-friendly: pasting into Notion turns ## into headings and - into bullets.
function toMarkdown(leads) {
  return leads.map((l) => {
    const lines = [`## ${l.name}`];
    if (l.headline) lines.push(`- Headline: ${l.headline}`);
    if (l.company) lines.push(`- Company: ${l.company}`);
    if (l.url) lines.push(`- Profile: ${l.url}`);
    if (l.tags.length) lines.push(`- Tags: ${l.tags.map((t) => "#" + t).join(" ")}`);
    if (l.notes) lines.push(`- Notes: ${l.notes}`);
    return lines.join("\n");
  }).join("\n\n---\n\n");
}

async function copyMarkdown() {
  const leads = await getLeads();
  if (!leads.length) return;
  const btn = $("copyMd");
  try {
    await navigator.clipboard.writeText(toMarkdown(leads));
    flash(btn, "Copied ✓");
  } catch (e) {
    flash(btn, "Copy failed");
  }
}

function flash(btn, msg) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; }, 1600);
}

async function downloadCsv() {
  const leads = await getLeads();
  if (!leads.length) return;
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const rows = [["name", "headline", "company", "profile_url", "tags", "notes", "created_at"]];
  for (const l of leads) {
    rows.push([l.name, l.headline, l.company, l.url, l.tags.join("; "), l.notes,
      new Date(l.created).toISOString()]);
  }
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "leads.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  flash($("dlCsv"), "Downloaded ✓");
}

async function pushWebhook() {
  const st = $("pushStatus");
  const url = $("webhook").value.trim();
  const leads = await getLeads();
  st.className = "note";
  if (!url) { st.textContent = "Enter your webhook URL first."; return; }
  if (!/^https?:\/\//i.test(url)) { st.textContent = "Webhook URL must start with http(s)://"; st.classList.add("err"); return; }
  if (!leads.length) { st.textContent = "No leads to push."; return; }
  st.textContent = "Pushing…";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "lead-pusher-extension", count: leads.length, leads }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    st.textContent = `✓ Pushed ${leads.length} lead${leads.length === 1 ? "" : "s"} (${res.status})`;
    st.classList.add("ok");
  } catch (e) {
    st.textContent = "Push failed: " + e.message;
    st.classList.add("err");
  }
}
