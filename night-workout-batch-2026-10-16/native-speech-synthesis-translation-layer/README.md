# Read Aloud — Page TTS Reader

**Honest scope:** this extension reads the current page's text aloud using the
browser's built-in speech synthesis (`speechSynthesis`). It does **NOT translate**
anything — no offline translation engine is available.

## What it does

- **Read aloud** — extracts the page's main text (or just your selection) and speaks it
- Voice picker (lists the browser's installed voices), rate slider (0.5–2×), pitch slider (0–2)
- Pause / resume / stop controls; preferences persist between sessions
- Text extraction is heuristic: prefers `article` / `main`, strips nav/ads/forms
- 100% local, zero network. Nothing runs until you click "Read aloud".

## Permissions

- `storage` — remember voice/rate/pitch preferences
- `activeTab` + `scripting` — read the current tab's text on click only

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, icons. No content script —
`chrome.scripting.executeScript` runs a tiny read-only text extractor on demand.

## Install

1. Open `chrome://extensions`, enable Developer mode
2. Load unpacked → select this folder (or install the `.zip`)
