# Idle Motivation New Tab

A kind new-tab page. After your browser has been idle past your threshold,
new tabs show a motivational quote and a gentle movement prompt from bundled
lists. When you're active, new tabs stay calm and minimal.

## What it does

- Overrides the new-tab page (`chrome_url_overrides`).
- On each new tab, checks `chrome.idle.queryState` against your threshold.
- Idle → random quote + gentle movement prompt, "New quote" button.
- Active → calm minimal message.
- Toolbar popup + in-page settings: enable toggle, idle threshold (5–120 min).

## Honest scope

- **Motivational only — never shaming. Not medical advice.**
- No guilt-tripping, no meme scraping, no accounts, no network.
- Minimal permissions: `storage` (settings), `idle` (detection).

## Files

- `manifest.json` — Manifest V3
- `newtab.html` / `newtab.css` / `newtab.js` — new-tab page
- `popup.html` / `popup.css` / `popup.js` — toolbar settings
- `background.js` — defaults + idle interval sync
- `icons/` — generated 16/48/128 PNG icons

## Install

1. Open `chrome://extensions`, enable Developer mode.
2. **Load unpacked** → select this folder (or install the `.zip`).
