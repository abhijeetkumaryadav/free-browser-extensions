// TabTree popup — shows quick stats and opens the side panel on demand.
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const tabs = await chrome.tabs.query({});
    const wins = await chrome.windows.getAll({});
    document.getElementById("tabCount").textContent = tabs.length;
    document.getElementById("winCount").textContent = wins.length;
  } catch (e) {
    // Stats are a nicety; the sidebar is the core feature.
  }

  document.getElementById("openBtn").addEventListener("click", async () => {
    try {
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      window.close();
    } catch (e) {
      console.warn("Could not open side panel:", e);
    }
  });
});
