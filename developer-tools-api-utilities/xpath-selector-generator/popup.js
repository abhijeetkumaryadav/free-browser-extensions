/* XPath Selector Generator — popup logic.
 * The picker runs as an injected content script (picker.js); it saves the
 * captured XPaths to storage because the popup closes on page click.
 */

"use strict";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("btnPick").addEventListener("click", startPicking);
  renderLastPick();
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab && tab.url) {
      try { $("pageInfo").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); }
      catch (e) { /* ignore */ }
    }
  });
});

/** Inject the picker content script into the active tab. */
async function startPicking() {
  const err = $("pickError");
  err.hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url) throw new Error("no-tab");
    if (!/^https?:|^file:/i.test(tab.url)) {
      throw new Error("Picking works on regular web pages (not on browser or store pages).");
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["picker.js"],
    });
    window.close(); // let the user click the page freely
  } catch (e) {
    err.hidden = false;
    err.textContent = e.message.startsWith("Picking")
      ? e.message
      : "Couldn't start picking on this page. Try a regular website.";
  }
}

/** Render the most recent capture from storage. */
async function renderLastPick() {
  const { lastPick } = await chrome.storage.local.get("lastPick");
  const empty = $("empty");
  const card = $("resultsCard");
  if (!lastPick || !Array.isArray(lastPick.xpaths) || !lastPick.xpaths.length) {
    empty.style.display = "";
    card.hidden = true;
    return;
  }
  empty.style.display = "none";
  card.hidden = false;

  const box = $("results");
  box.innerHTML = "";
  for (const x of lastPick.xpaths) {
    const wrap = document.createElement("div");
    wrap.className = "xp";

    const head = document.createElement("div");
    head.className = "head";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = x.label;
    const count = document.createElement("span");
    count.className = "count " + (x.count === 1 ? "unique" : x.count > 1 ? "multi" : "none");
    count.textContent = x.count < 0 ? "error" : x.count + (x.count === 1 ? " match" : " matches");
    count.title = x.count === 1
      ? "Unique — ideal for automation"
      : x.count > 1 ? "Matches several elements" : "Matches nothing on the page";
    head.append(label, count);

    const code = document.createElement("code");
    code.textContent = x.xpath;

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(x.xpath);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
      } catch (e) {
        copyBtn.textContent = "Select manually";
      }
    });

    wrap.append(head, code, copyBtn);
    box.appendChild(wrap);
  }

  const meta = $("pickedMeta");
  try {
    meta.textContent = `Picked <${lastPick.tag}> on ${new URL(lastPick.url).hostname.replace(/^www\./, "")}`;
  } catch (e) {
    meta.textContent = `Picked <${lastPick.tag}>`;
  }
}
