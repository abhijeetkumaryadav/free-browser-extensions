// Screenshot Studio — popup: capture the visible tab, hand off to the editor.

document.getElementById("capture").addEventListener("click", async () => {
  const btn = document.getElementById("capture");
  const status = document.getElementById("status");
  btn.disabled = true;
  status.textContent = "Capturing…";
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab || !tab.id || !tab.windowId) throw new Error("no-tab");
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    await chrome.storage.local.set({ pendingShot: dataUrl });
    await chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
    window.close();
  } catch (e) {
    status.textContent =
      "Couldn’t capture this tab — try a regular website instead.";
    btn.disabled = false;
  }
});
