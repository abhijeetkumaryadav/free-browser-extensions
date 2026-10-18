# FlashGuard — Seizure-Safe Animation Killer

Detects rapid-flashing CSS animations on web pages and can suppress them. A user-triggered accessibility aid.

## What it does

- **Scan this page** — finds elements whose CSS animations cycle faster than your threshold (default 500 ms), then samples their opacity to confirm real flashing vs. harmless motion. Results are labeled `FLASHING` (confirmed on/off toggling) or `FAST` (rapid animation, not confirmed flashing).
- **Pause risky** — pauses animations on the flagged elements only.
- **Kill all animations** — injects a stylesheet that disables all CSS animations and transitions on the tab. Persists across navigation while enabled.

## Honest scope

Detection is **heuristic**: it combines computed-style animation durations with short opacity sampling. It cannot see canvas/WebGL flashing, video content, or GIFs, and it is **not a medical device**. If you feel unwell, look away immediately.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` + `scripting` | Inject the scanner only when you click Scan / toggle |
| `storage` | Remember your toggle + threshold |
| `<all_urls>` (host) | So the kill-switch can re-apply on any page you visit |

No network requests. Nothing leaves your device.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Pin FlashGuard, open any page, click the icon.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup
- `content.js` — page scanner + suppression
- `background.js` — re-applies kill-switch on navigation
- `icons/` — generated PNG icons (16/48/128)
