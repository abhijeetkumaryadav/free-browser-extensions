# Circadian Dimmer — Warm Wind-Down Overlay

A Manifest V3 extension that dims the active tab with a warm, pointer-transparent
overlay during your wind-down hours.

## What it does

- **Per-tab dimming**: click "Dim this tab" to apply a warm overlay (adjustable strength 5–80%). "Remove" takes it off.
- **Wind-down schedule**: set start/end hours (overnight ranges supported, e.g. 21:00 → 07:00). A background check every 15 minutes clears leftover overlays once the window ends, and the toolbar badge shows 🌙 while inside the window.
- **100% local**: settings in `chrome.storage.local`. Zero network.

## Honest scope

Comfort dimming only — **not medical advice**. It changes how pages look, not how your body works.

## Permissions

- `storage` — schedule + opacity settings
- `activeTab` + `scripting` — inject the overlay into the tab you click on (nothing runs until you press the button)
- `alarms` — periodic schedule re-evaluation

## Files

- `manifest.json`, `popup.html`, `popup.css`, `popup.js`
- `content.js` — overlay engine (injected on demand)
- `background.js` — schedule watcher
- `icons/icon{16,48,128}.png`
