# FlapDash — Spacebar Divert

A smooth flappy-style arcade game that lives in your browser toolbar. Flap with the spacebar or a click, thread the pipes, and chase your best score — with a day/night sky that cycles as you play.

## Install (load unpacked)

**Chrome / Edge / Opera**
1. Download and unzip `flappy-bird-spacebar-divert.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.

**Firefox** — this build targets Chromium MV3; for Firefox, the manifest and APIs used (`storage`) are MV3-compatible, but load via `about:debugging → This Firefox → Load Temporary Add-on` and report any issues.

## How to play

1. Click the toolbar icon to open the game.
2. Press **Spacebar** (or click) to flap.
3. Thread the pipes — each pipe cleared scores a point.
4. Your best score is saved on-device.

The sky cycles through day and night roughly every 40 seconds, with stars and a sun/moon arc.

## Permissions

- `storage` — saves your best score locally on your device. Nothing else is stored or transmitted.

No network requests, no analytics, no data collection.

## Publishing notes

- Manifest V3, no remote code, no deprecated APIs.
- All art is drawn at runtime on canvas; icons are locally generated PNGs.
- Suitable for the Chrome Web Store "Games" category.
