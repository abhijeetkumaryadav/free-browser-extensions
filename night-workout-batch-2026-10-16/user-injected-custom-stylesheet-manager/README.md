# StyleForge — Custom Stylesheet Manager

Write your own CSS rules and apply them per-site or globally. A lightweight,
fully local alternative to heavyweight style managers.

## Features
- Create named CSS rules with **Global** or **This site** scope (domain matching)
- Toggle rules on/off individually — changes apply to the active tab immediately
- Delete rules; import/export the whole rule set as JSON
- Background worker reapplies matching rules on page load

## Honest scope
- Your CSS is injected as a `<style>` node on matching sites only — nothing on a
  page is read, and no data ever leaves your device
- Imported rule files are parsed defensively; malformed entries are skipped
- All rules live in `chrome.storage.local`

## Permissions
- `scripting` + `<all_urls>` host — inject your configured CSS on matching sites
  (injected only where your rules apply; content script listens for messages only)
- `tabs` — re-apply rules to the active tab when you toggle a rule
- `storage` — persist your rules

## Install (developer mode)
1. Open `chrome://extensions`, enable Developer mode
2. "Load unpacked" → select this folder
3. Click the toolbar icon, write a rule, hit "Add rule"
