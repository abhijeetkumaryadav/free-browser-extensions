# Typing Speed Test Overlay

A fully local typing-speed test that runs on any web page. Click **Start test on this tab** — a 60-second typing overlay appears with a bundled passage. When you're done (or time runs out), close it and the page is restored exactly as it was.

## Game only — reversible, offline

- **9 bundled passages** in 3 difficulties (Easy / Medium / Hard) — no network.
- Live HUD: seconds remaining, WPM, accuracy — plus per-character error highlighting.
- Final screen: WPM, accuracy, **consistency** (steadiness of your per-second pace).
- Best WPM / accuracy and recent results persist locally in the browser.
- **Esc** or ✕ closes the overlay instantly; the page DOM is never modified.

## Files

- `manifest.json` — Manifest V3 (`storage`, `activeTab`, `scripting` permissions).
- `popup.html` / `popup.css` — 380px deep-dark glassmorphism popup, single cyan accent, Lucide-style outline icons.
- `popup.js` — passage/difficulty picker, best scores, history.
- `background.js` — service worker that injects the overlay on the active tab.
- `content.js` — the typing-test overlay game (boot-once, fully removes itself).
- `icons/icon16.png`, `icon48.png`, `icon128.png` — generated PNG icons.

## Install (development)

1. Open `chrome://extensions` (or `edge://extensions`) and enable Developer mode.
2. Click **Load unpacked** and select this folder.
3. Click the extension icon, pick a passage, and start typing.
