/* DeployBadger — popup logic
 * - Reads a user-supplied Vercel or Netlify token from chrome.storage.local.
 * - Fetches recent deployments from the provider API. The token is sent ONLY
 *   to the selected provider's API host. Nothing else ever touches the network.
 */
"use strict";

// ---------- Storage keys ----------
const K = { provider: "db_provider", token: "db_token", auto: "db_auto" };
const ALARM_NAME = "deploybadger-refresh";
const AUTO_MINUTES = 5;

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const setupView = $("setupView"), mainView = $("mainView");
const tokenInput = $("tokenInput"), tokenHint = $("tokenHint");
const saveBtn = $("saveBtn"), setupError = $("setupError");
const refreshBtn = $("refreshBtn"), logoutBtn = $("logoutBtn");
const providerTag = $("providerTag"), lastCheck = $("lastCheck");
const autoToggle = $("autoToggle"), deployList = $("deployList");
const emptyState = $("emptyState"), listError = $("listError");

let provider = "vercel";

// ---------- Provider config ----------
const PROVIDERS = {
  vercel: {
    label: "Vercel",
    hint: 'Vercel: <span class="mono">vercel.com → Account → Tokens</span> (read scope is enough). Stored only on this device, sent only to api.vercel.com.',
    headers: (t) => ({ Authorization: `Bearer ${t}` }),
    async fetchDeployments(t) {
      const res = await fetch("https://api.vercel.com/v6/deployments?limit=12", { headers: this.headers(t) });
      if (!res.ok) throw new Error(`Vercel API ${res.status}`);
      const data = await res.json();
      return (data.deployments || []).map((d) => ({
        name: d.name || d.url || "deployment",
        url: d.url ? `https://${d.url}` : null,
        state: (d.state || "unknown").toLowerCase(),   // READY | BUILDING | ERROR | QUEUED | CANCELED
        meta: [d.meta?.githubCommitMessage || d.meta?.githubCommitRef, timeAgo(d.created)].filter(Boolean).join(" · "),
      }));
    },
  },
  netlify: {
    label: "Netlify",
    hint: 'Netlify: <span class="mono">app.netlify.com → User settings → Applications → New access token</span>. Stored only on this device, sent only to api.netlify.com.',
    headers: (t) => ({ Authorization: `Bearer ${t}` }),
    async fetchDeployments(t) {
      const res = await fetch("https://api.netlify.com/api/v1/sites?per_page=5", { headers: this.headers(t) });
      if (!res.ok) throw new Error(`Netlify API ${res.status}`);
      const sites = await res.json();
      const out = [];
      for (const s of sites.slice(0, 4)) {
        const dr = await fetch(`https://api.netlify.com/api/v1/sites/${s.id}/deploys?per_page=3`, { headers: this.headers(t) });
        if (!dr.ok) continue;
        const deploys = await dr.json();
        for (const d of deploys) {
          const st = String(d.state || "").toLowerCase(); // ready | building | error
          out.push({
            name: s.name || s.id,
            url: d.deploy_ssl_url || d.ssl_url || s.ssl_url,
            state: st === "ready" ? "ready" : st === "building" ? "building" : st === "error" ? "error" : st,
            meta: [d.branch || d.context, timeAgo(Date.parse(d.created_at))].filter(Boolean).join(" · "),
          });
        }
      }
      return out.slice(0, 12);
    },
  },
};

// ---------- Helpers ----------
function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}
function hideError(el) { el.hidden = true; }

// ---------- Rendering ----------
function renderDeployments(items) {
  deployList.innerHTML = "";
  emptyState.hidden = items.length > 0;
  for (const d of items) {
    const a = document.createElement("a");
    a.className = "deploy";
    a.target = "_blank";
    a.rel = "noopener";
    if (d.url) a.href = d.url;
    a.innerHTML = `
      <span class="state-dot ${esc(d.state)}"></span>
      <div class="deploy-info">
        <div class="deploy-name">${esc(d.name)}</div>
        <div class="deploy-meta">${esc(d.meta)}</div>
      </div>
      <span class="badge ${esc(d.state)}">${esc(d.state)}</span>`;
    deployList.appendChild(a);
  }
}

function setBadge(failedCount) {
  if (failedCount > 0) {
    chrome.action.setBadgeText({ text: String(failedCount) });
    chrome.action.setBadgeBackgroundColor({ color: "#f87171" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// ---------- Data flow ----------
async function loadDeployments(showSpinner = true) {
  const { [K.token]: token, [K.provider]: prov } = await chrome.storage.local.get([K.token, K.provider]);
  if (!token || !prov) { showSetup(); return; }
  provider = prov;

  if (showSpinner) { refreshBtn.classList.add("spin"); }
  hideError(listError);
  try {
    const items = await PROVIDERS[provider].fetchDeployments(token);
    renderDeployments(items);
    const failed = items.filter((d) => d.state === "error" || d.state === "failed").length;
    setBadge(failed);
    lastCheck.textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (err) {
    showError(listError, "Could not load deployments: " + err.message + ". Check your token and network.");
  } finally {
    refreshBtn.classList.remove("spin");
  }
}

// ---------- Views ----------
function showSetup() {
  setupView.hidden = false;
  mainView.hidden = true;
}
function showMain() {
  setupView.hidden = true;
  mainView.hidden = false;
  providerTag.textContent = PROVIDERS[provider].label;
}

// ---------- Events ----------
document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".seg-btn").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    provider = btn.dataset.provider;
    tokenHint.innerHTML = PROVIDERS[provider].hint;
  });
});

saveBtn.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  hideError(setupError);
  if (!token) { showError(setupError, "Please paste your personal access token."); return; }
  saveBtn.disabled = true;
  try {
    // Validate the token with a cheap API call before saving.
    await PROVIDERS[provider].fetchDeployments(token);
    await chrome.storage.local.set({ [K.provider]: provider, [K.token]: token });
    tokenInput.value = "";
    showMain();
    await loadDeployments();
  } catch (err) {
    showError(setupError, "Token rejected or network error: " + err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

refreshBtn.addEventListener("click", () => loadDeployments(true));

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove([K.token, K.provider, K.auto]);
  await chrome.alarms.clear(ALARM_NAME);
  setBadge(0);
  tokenInput.value = "";
  showSetup();
});

autoToggle.addEventListener("click", async () => {
  const on = autoToggle.getAttribute("aria-checked") === "true";
  const next = !on;
  autoToggle.setAttribute("aria-checked", String(next));
  await chrome.storage.local.set({ [K.auto]: next });
  if (next) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: AUTO_MINUTES });
  } else {
    await chrome.alarms.clear(ALARM_NAME);
  }
});

// ---------- Init ----------
(async function init() {
  const { [K.token]: token, [K.provider]: prov, [K.auto]: auto } = await chrome.storage.local.get([K.token, K.provider, K.auto]);
  if (token && prov && PROVIDERS[prov]) {
    provider = prov;
    showMain();
    autoToggle.setAttribute("aria-checked", String(auto === true));
    await loadDeployments();
  } else {
    tokenHint.innerHTML = PROVIDERS[provider].hint;
    showSetup();
  }
})();
