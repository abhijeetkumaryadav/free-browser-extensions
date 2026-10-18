/* Cookie Purger — lists cookies for the active tab's site and deletes
 * user-selected ones. All work is user-triggered; nothing runs in the background.
 * Deleting cookies may log you out of the site — warned in the UI. */

const $ = (id) => document.getElementById(id);
const listEl = $("cookieList");
const statusEl = $("status");
const siteLabel = $("siteLabel");
const countLabel = $("countLabel");
const selectAllBox = $("selectAll");
const deleteSelectedBtn = $("deleteSelected");
const deleteAllBtn = $("deleteAll");

let cookies = [];   // currently listed cookies for this site
let baseDomain = "";

/** Extract a registrable-ish host from the active tab URL. */
function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

/** Build the URL needed by chrome.cookies.remove() for a given cookie. */
function cookieUrl(cookie) {
  const scheme = cookie.secure ? "https://" : "http://";
  const domain = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain;
  return scheme + domain + cookie.path;
}

/** Human-friendly expiry label. Session cookies have no expirationDate. */
function expiryLabel(cookie) {
  if (!cookie.expirationDate) return "Session";
  const d = new Date(cookie.expirationDate * 1000);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Render the cookie list with per-cookie checkboxes. */
function render() {
  listEl.innerHTML = "";
  if (!cookies.length) {
    listEl.innerHTML = '<div class="empty">No cookies found for this site.</div>';
  }
  cookies.forEach((cookie, i) => {
    const row = document.createElement("label");
    row.className = "cookie";
    row.setAttribute("role", "listitem");

    const box = document.createElement("input");
    box.type = "checkbox";
    box.dataset.index = i;
    box.addEventListener("change", refreshButtons);
    // Clicking the row (not the box) toggles it.
    row.addEventListener("click", (e) => {
      if (e.target !== box) { box.checked = !box.checked; refreshButtons(); }
    });

    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = cookie.name;
    const detail = document.createElement("div");
    detail.className = "detail";
    const flags = [
      cookie.secure ? "Secure" : null,
      cookie.httpOnly ? "HttpOnly" : null,
      "SameSite=" + (cookie.sameSite || "unspecified"),
      "Expires: " + expiryLabel(cookie),
    ].filter(Boolean).join(" · ");
    detail.textContent = cookie.domain + "  —  " + flags;

    meta.append(name, detail);
    row.append(box, meta);
    listEl.appendChild(row);
  });

  countLabel.textContent = cookies.length + (cookies.length === 1 ? " cookie" : " cookies");
  selectAllBox.checked = false;
  refreshButtons();
}

/** Enable/disable action buttons based on selection state. */
function refreshButtons() {
  const anyChecked = listEl.querySelectorAll("input:checked").length > 0;
  deleteSelectedBtn.disabled = !anyChecked;
  deleteAllBtn.disabled = cookies.length === 0;
}

selectAllBox.addEventListener("change", () => {
  listEl.querySelectorAll("input[type=checkbox]").forEach((b) => { b.checked = selectAllBox.checked; });
  refreshButtons();
});

/** Delete exactly the checked cookies, then refresh the list. */
deleteSelectedBtn.addEventListener("click", async () => {
  const indexes = [...listEl.querySelectorAll("input:checked")].map((b) => Number(b.dataset.index));
  let removed = 0;
  for (const i of indexes) {
    const c = cookies[i];
    try { await chrome.cookies.remove({ url: cookieUrl(c), name: c.name, storeId: c.storeId }); removed++; }
    catch (e) { /* keep going; report at the end */ }
  }
  statusEl.textContent = removed + " of " + indexes.length + " selected cookie(s) deleted.";
  await load();
});

/** Delete ALL cookies for this site — behind an explicit confirmation. */
deleteAllBtn.addEventListener("click", async () => {
  if (!confirm("Delete all " + cookies.length + " cookies for " + baseDomain + "?\nThis may log you out of the site.")) return;
  let removed = 0;
  for (const c of cookies) {
    try { await chrome.cookies.remove({ url: cookieUrl(c), name: c.name, storeId: c.storeId }); removed++; }
    catch (e) { /* keep going */ }
  }
  statusEl.textContent = removed + " cookie(s) deleted for " + baseDomain + ".";
  await load();
});

/** Load cookies for the active tab's site. */
async function load() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  baseDomain = hostOf(tab && tab.url);
  if (!baseDomain) {
    siteLabel.textContent = "Could not determine the current site.";
    cookies = [];
    render();
    return;
  }
  siteLabel.textContent = baseDomain;
  // Match the exact host plus any subdomains of it (e.g. .example.com covers www.example.com).
  const all = await chrome.cookies.getAll({});
  const host = baseDomain.toLowerCase();
  cookies = all.filter((c) => {
    const d = c.domain.toLowerCase().replace(/^\./, "");
    return d === host || d.endsWith("." + host) || host.endsWith("." + d);
  }).sort((a, b) => a.name.localeCompare(b.name));
  statusEl.textContent = "Nothing has been deleted yet.";
  render();
}

document.addEventListener("DOMContentLoaded", load);
