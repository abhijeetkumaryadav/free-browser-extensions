// popup.js — triggers / dismisses the cartoonish prank overlay on the current tab.
"use strict";

const triggerBtn = document.getElementById("trigger");
const dismissBtn = document.getElementById("dismiss");

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(cmd) {
  const tab = await currentTab();
  try {
    // Inject first (idempotent guard inside), then command.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: cmd });
  } catch (err) {
    // Restricted pages (chrome://, Web Store, etc.) reject injection.
    triggerBtn.textContent = "Can't prank this page";
    setTimeout(() => { triggerBtn.textContent = "Trigger the prank"; }, 2000);
  }
}

triggerBtn.addEventListener("click", () => send("fu-show"));
dismissBtn.addEventListener("click", () => send("fu-hide"));
