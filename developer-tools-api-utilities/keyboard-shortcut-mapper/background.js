// Keyboard Shortcut Mapper — background service worker.
// Fires the action stored for a shortcut slot when its command is pressed.

chrome.commands.onCommand.addListener(async (command) => {
  const { slots = [] } = await chrome.storage.local.get("slots");
  const slot = slots.find((s) => s.command === command);
  if (!slot || !slot.value || !slot.value.trim()) return;

  if (slot.type === "url") {
    let url = slot.value.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
      await chrome.tabs.create({ url });
    } catch (e) {
      /* invalid URL — ignore quietly */
    }
  } else if (slot.type === "snippet") {
    try {
      await ensureOffscreen();
      await chrome.runtime.sendMessage({ target: "offscreen", type: "copy", text: slot.value });
    } catch (e) {
      /* clipboard unavailable — ignore quietly */
    }
  }
});

async function ensureOffscreen() {
  const url = chrome.runtime.getURL("offscreen.html");
  let contexts = [];
  try {
    contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [url],
    });
  } catch (e) {
    // getContexts unsupported — fall through and try creating
  }
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url,
    reasons: ["CLIPBOARD"],
    justification: "Copy saved snippets to the clipboard when a mapped shortcut is pressed",
  });
}
