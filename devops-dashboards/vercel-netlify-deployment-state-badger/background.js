/* DeployBadger — background service worker
 * Handles the auto-refresh alarm: re-fetches deployments and updates the
 * toolbar badge with the failed-deployment count. The token is only sent
 * to the provider API the user configured.
 */
"use strict";

const ALARM_NAME = "deploybadger-refresh";
const K = { provider: "db_provider", token: "db_token" };

const STATE_MAP = { ready: "ready", success: "ready", building: "building", running: "building", error: "error", failed: "error" };

async function fetchVercel(token) {
  const res = await fetch("https://api.vercel.com/v6/deployments?limit=12", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.deployments || []).map((d) => (d.state || "").toLowerCase());
}

async function fetchNetlify(token) {
  const states = [];
  const res = await fetch("https://api.netlify.com/api/v1/sites?per_page=4", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const sites = await res.json();
  for (const s of sites.slice(0, 4)) {
    const dr = await fetch(`https://api.netlify.com/api/v1/sites/${s.id}/deploys?per_page=3`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!dr.ok) continue;
    for (const d of await dr.json()) states.push(String(d.state || "").toLowerCase());
  }
  return states;
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const { [K.token]: token, [K.provider]: provider } = await chrome.storage.local.get([K.token, K.provider]);
  if (!token || !provider) return;
  try {
    const states = provider === "vercel" ? await fetchVercel(token) : await fetchNetlify(token);
    const failed = states.filter((s) => STATE_MAP[s] === "error").length;
    if (failed > 0) {
      await chrome.action.setBadgeText({ text: String(failed) });
      await chrome.action.setBadgeBackgroundColor({ color: "#f87171" });
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }
  } catch {
    // Network hiccup — leave the badge as-is; next tick retries.
  }
});
