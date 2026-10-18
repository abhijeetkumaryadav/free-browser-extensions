/* Typing Speed Test Overlay — background service worker
 * Injects the overlay content script on the active tab when the popup asks.
 * Guards against internal browser pages where injection is forbidden.
 */

const TEST_DURATION_MS = 60_000;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "start-test") {
    startTestOnActiveTab(msg).then(sendResponse);
    return true; // async response
  }
});

async function startTestOnActiveTab({ text, title, difficulty }) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return { ok: false, error: "No active tab found." };
    const url = tab.url || "";
    if (/^(chrome|edge|about|chrome-extension|opera|brave):\/\//.test(url)) {
      return { ok: false, error: "Typing tests cannot run on internal browser pages." };
    }
    // Send any existing overlay away first (idempotent), then inject fresh
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__tstRemove && window.__tstRemove(),
    }).catch(() => {});
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    // Hand the test config to the injected script
    await chrome.tabs.sendMessage(tab.id, {
      type: "tst-begin",
      text,
      title,
      difficulty,
      durationMs: TEST_DURATION_MS,
    }).catch(() => ({}));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "Injection failed: " + (err && err.message ? err.message : err) };
  }
}
