# Deepfake Heuristic Warner

A **defensive media-literacy aid** built as a Chrome/Edge MV3 extension. It helps you
spot *possible* signs of synthetic media — it does **not** detect deepfakes.

## What it does
- **On-demand page scan** ("Scan this page") collects images, videos and audio on the active tab and runs **local heuristic checks**:
  - Images: upscaled display vs. actual file size, tiny/hidden elements, suspicious URL tokens, and the JPEG EXIF "Software" tag (same-origin files only, fetched locally).
  - Video: unreadable duration, very short looping clips, suspicious URL tokens.
  - Audio: presence noted — no automated voice analysis is possible locally.
- **Reverse-image-search links** (Google Lens, TinEye) per image so you can hunt for the original yourself.
- **Educational checklist** of deepfake tells: lighting, skin, blinking, lip-sync, warped backgrounds, voice tone, source checking.

## Honest scope — read this
- **Heuristic signals only.** This tool **cannot tell you whether media is real or fake.**
- **No AI analysis** is performed anywhere.
- Signals can **miss real fakes and flag innocent media** (e.g. a legitimately upscaled photo).
- Never shown as a verdict — every finding is labeled *informational*.
- 100% local: page content never leaves your device (reverse-search links open in your browser only when *you* click them).

## Permissions
- `activeTab` + `scripting` — run the scan only when you click the button, on the current tab only.
- `storage` — remembers when you last scanned (best-effort).

## Install (developer mode)
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI + scan orchestration
- `content.js` — the on-page media scanner (`window.__dfScan`)
- `icons/` — generated PNG icons (16/48/128)
