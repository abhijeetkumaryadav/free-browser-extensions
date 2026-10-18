// Offscreen clipboard helper — receives {target:"offscreen", type:"copy", text}
// from the service worker and writes it to the clipboard.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.target === "offscreen" && msg.type === "copy") {
    navigator.clipboard
      .writeText(msg.text || "")
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // keep the channel open for the async response
  }
});
