# Motion Calm — Animation & Flash Reducer

Reduce CSS animations, transitions, and bright media flashing on any page — on your click only, one click to restore.

## What it does

- **Freeze motion** — injects a site-wide override that stops CSS animations and transitions
  (`animation-duration: 0.001ms`, `transition-duration: 0.001ms`) and forces instant scrolling.
- **Strict — freeze + dim media** — additionally dims images, video, canvas, and embeds
  (`brightness(0.72)`) to soften bright flashing content.
- **Remove** — deletes the single injected style element, restoring the page exactly.
- Your chosen mode is remembered in `chrome.storage.local`.

## Honest scope

- This extension **reduces animation only**. It cannot detect or prevent all flashing (e.g. JavaScript-driven
  canvas/WebGL flashes, OS-level effects), and it **cannot guarantee seizure safety**.
- It is a vestibular-comfort aid, **not a medical device**. If you feel unwell, leave the page and consult a doctor.
- Nothing runs until you click. Everything is local — no network calls, no analytics.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. On any busy page, click the toolbar icon, pick a mode, and hit **Apply to this page**.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest (permissions: `storage`, `activeTab`, `scripting`) |
| `popup.html` / `popup.css` / `popup.js` | 380px deep-dark glassmorphism UI + mode picker |
| `content.js` | Page-side style injector (boot-once, message-driven) |
| `icons/` | Generated PNG icons (16/48/128) |
| `README.md` | This file |

## Privacy

All settings stay in `chrome.storage.local` on your device. The extension never contacts the network.
