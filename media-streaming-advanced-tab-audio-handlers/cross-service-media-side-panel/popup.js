/* Stagehand popup — opens the side panel (Chromium). Fallback note elsewhere. */
"use strict";
document.getElementById("openPanel").addEventListener("click", async () => {
  try {
    const win = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: win.id });
    window.close();
  } catch (err) {
    document.querySelector(".hint").textContent =
      "Side panels need a Chromium browser (Chrome/Edge 114+). Open it from the toolbar side-panel icon.";
  }
});
