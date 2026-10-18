// Open Graph Meta Previewer — popup logic.
// extractMeta() is injected into the page; it must stay self-contained.

function extractMeta() {
  const tags = {};
  document.querySelectorAll('meta[property], meta[name]').forEach((m) => {
    const key = (m.getAttribute("property") || m.getAttribute("name") || "").toLowerCase();
    const val = m.getAttribute("content");
    if (key && val != null && !(key in tags)) tags[key] = val;
  });
  const abs = (u) => { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } };
  return {
    title: document.title || "",
    url: location.href,
    host: location.hostname.replace(/^www\./, ""),
    ogTitle: tags["og:title"] || "",
    ogDesc: tags["og:description"] || "",
    ogImage: tags["og:image"] ? abs(tags["og:image"]) : "",
    ogUrl: tags["og:url"] || "",
    ogType: tags["og:type"] || "",
    ogSite: tags["og:site_name"] || "",
    twCard: tags["twitter:card"] || "",
    twTitle: tags["twitter:title"] || "",
    twDesc: tags["twitter:description"] || "",
    twImage: tags["twitter:image"] ? abs(tags["twitter:image"]) : "",
  };
}

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("scan").addEventListener("click", scan);
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab && tab.url) { try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {} }
  });
});

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractMeta });
    const m = res && res.result;
    if (!m) throw new Error("no-data");
    $("empty").style.display = "none";
    renderChecklist(m);
    renderCards(m);
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t read this page — it may be a browser page or restricted.";
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

function addCheck(box, state, label, hint) {
  const row = document.createElement("div");
  row.className = "check " + state;
  const ic = document.createElement("div");
  ic.className = "ic";
  ic.textContent = state === "ok" ? "✓" : state === "warn" ? "!" : "✕";
  const tx = document.createElement("div");
  tx.innerHTML = `<b>${label}</b>` + (hint ? `<small>${hint}</small>` : "");
  row.append(ic, tx);
  box.appendChild(row);
  return state === "ok" ? 1 : state === "warn" ? 0.5 : 0;
}

function renderChecklist(m) {
  $("scoreCard").hidden = false;
  const box = $("checks");
  box.innerHTML = "";
  let got = 0, total = 0;
  const chk = (state, label, hint) => { total++; got += addCheck(box, state, label, hint); };

  if (!m.ogTitle) chk("bad", "og:title missing", "Networks fall back to <title>; set it explicitly.");
  else if (m.ogTitle.length > 60) chk("warn", `og:title is ${m.ogTitle.length} chars`, "Keep under ~60 so it isn't truncated.");
  else chk("ok", "og:title present", `${m.ogTitle.length} chars.`);

  if (!m.ogDesc) chk("bad", "og:description missing", "Cards will show no description text.");
  else if (m.ogDesc.length > 200) chk("warn", `og:description is ${m.ogDesc.length} chars`, "Keep under ~200 to avoid truncation.");
  else if (m.ogDesc.length < 50) chk("warn", "og:description is very short", "Aim for 50–200 chars.");
  else chk("ok", "og:description present", `${m.ogDesc.length} chars.`);

  if (!m.ogImage) chk("bad", "og:image missing", "Cards render without an image — the biggest engagement loss.");
  else chk("ok", "og:image present", "Use at least 1200×630 for best quality.");

  if (!m.ogUrl) chk("warn", "og:url missing", "Add the canonical URL for consistent sharing.");
  else chk("ok", "og:url present", "");

  if (!m.ogType) chk("warn", "og:type missing", "Defaults to 'website'; set 'article' for posts.");
  else chk("ok", `og:type = ${m.ogType}`, "");

  if (!m.twCard) chk("warn", "twitter:card missing", "Defaults to summary; set summary_large_image for big cards.");
  else chk("ok", `twitter:card = ${m.twCard}`, "");

  if (!m.ogSite) chk("warn", "og:site_name missing", "Helps brand attribution on cards.");
  else chk("ok", "og:site_name present", "");

  const score = Math.round((got / total) * 100);
  $("scoreNum").textContent = score;
  $("scoreSub").textContent = score >= 85 ? "Share-ready." : score >= 60 ? "Decent — fix the warnings." : "Needs work before sharing.";
}

function setImg(el, url) {
  if (url) { el.style.backgroundImage = `url("${url.replace(/"/g, "")}")`; }
  else { el.style.backgroundImage = "none"; }
}

function renderCards(m) {
  $("cards").hidden = false;
  const title = m.ogTitle || m.title || "(no title)";
  const desc = m.ogDesc || "(no description)";
  const img = m.ogImage;
  const twTitle = m.twTitle || title;
  const twDesc = m.twDesc || desc;
  const twImg = m.twImage || img;

  setImg($("xImg"), twImg);
  $("xTitle").textContent = twTitle;
  $("xDesc").textContent = twDesc;
  $("xDomain").textContent = m.host;

  setImg($("fbImg"), img);
  $("fbDomain").textContent = m.host;
  $("fbTitle").textContent = title;
  $("fbDesc").textContent = desc;

  setImg($("liImg"), img);
  $("liTitle").textContent = title;
  $("liDomain").textContent = m.host;
}
