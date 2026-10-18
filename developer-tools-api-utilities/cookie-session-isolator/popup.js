// Cookie Session Isolator — popup logic.
// Privacy session reset: inspect cookies for the current site, then
// clear cookies + site storage with explicit confirmation. All on-device.

const $ = (id) => document.getElementById(id);
let tabUrl = null, tabId = null, origin = null, armed = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("clearBtn").addEventListener("click", onClearClick);
  $("freshBtn").addEventListener("click", onFreshClick);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return fail("No active tab.");
  try {
    const u = new URL(tab.url);
    if (!/^https?:$/.test(u.protocol)) return fail("Works on regular http(s) pages only.");
    tabUrl = tab.url; tabId = tab.id; origin = u.origin;
    $("hostLine").textContent = u.hostname.replace(/^www\./, "");
  } catch (e) { return fail("Could not read this tab."); }
  listCookies();
}

function fail(msg) {
  $("cookieList").innerHTML = "";
  const d = document.createElement("div");
  d.className = "empty"; d.textContent = msg;
  $("cookieList").appendChild(d);
}

async function listCookies() {
  try {
    const cookies = await chrome.cookies.getAll({ url: tabUrl });
    $("countPill").textContent = cookies.length;
    const box = $("cookieList");
    box.innerHTML = "";
    if (!cookies.length) {
      const d = document.createElement("div");
      d.className = "empty"; d.textContent = "No cookies for this site.";
      box.appendChild(d);
      return;
    }
    for (const c of cookies.slice(0, 50)) {
      const row = document.createElement("div");
      row.className = "cookie";
      const nm = document.createElement("div");
      nm.className = "nm"; nm.textContent = c.name;
      const val = document.createElement("div");
      val.className = "val"; val.textContent = maskValue(c.value);
      const meta = document.createElement("div");
      meta.className = "meta";
      const dom = document.createElement("span");
      dom.textContent = "Domain: " + c.domain.replace(/^\./, "");
      const exp = document.createElement("span");
      if (c.expirationDate) {
        exp.textContent = "Expires " + new Date(c.expirationDate * 1000).toLocaleDateString();
      } else {
        exp.textContent = "Session cookie"; exp.className = "sess";
      }
      const sec = document.createElement("span");
      sec.textContent = (c.secure ? "Secure" : "Not secure") + (c.httpOnly ? " · HttpOnly" : "");
      meta.append(dom, exp, sec);
      row.append(nm, val, meta);
      box.appendChild(row);
    }
    if (cookies.length > 50) {
      const more = document.createElement("div");
      more.className = "empty";
      more.textContent = `+ ${cookies.length - 50} more`;
      box.appendChild(more);
    }
  } catch (e) { fail("Could not read cookies."); }
}

// Show a short masked preview — full cookie values stay private.
function maskValue(v) {
  if (!v) return "(empty)";
  if (v.length <= 8) return v.slice(0, 2) + "••••";
  return v.slice(0, 4) + "••••••••" + v.slice(-2);
}

// Injected into the page: clear web storage for this origin.
function clearWebStorage() {
  try { localStorage.clear(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
}

async function clearSiteData() {
  const status = $("status");
  status.hidden = false; status.textContent = "Clearing…";
  try {
    // Cookies + localStorage + indexedDB + service workers + cache for this origin.
    await chrome.browsingData.remove(
      { origins: [origin] },
      { cookies: true, localStorage: true, indexedDB: true, serviceWorkers: true, cache: true }
    );
    // sessionStorage isn't covered by browsingData — clear it in-page.
    if (tabId != null) {
      try {
        await chrome.scripting.executeScript({ target: { tabId }, func: clearWebStorage });
      } catch (e) { /* page may restrict scripting; storage already cleared */ }
    }
    status.textContent = "✓ Site data cleared.";
    listCookies();
  } catch (e) {
    status.textContent = "Clear failed — try reloading the page first.";
  }
}

// Two-step confirmation: first click arms, second click executes.
async function onClearClick() {
  const btn = $("clearBtn");
  if (!armed) {
    armed = true; btn.classList.add("armed");
    btn.textContent = "Click again to confirm";
    setTimeout(() => {
      armed = false; btn.classList.remove("armed");
      btn.textContent = "Clear site data";
    }, 4000);
    return;
  }
  armed = false; btn.classList.remove("armed");
  btn.textContent = "Clear site data";
  await clearSiteData();
}

async function onFreshClick() {
  await clearSiteData();
  if (tabId != null) {
    try { await chrome.tabs.reload(tabId); window.close(); }
    catch (e) { /* tab may be gone */ }
  }
}
