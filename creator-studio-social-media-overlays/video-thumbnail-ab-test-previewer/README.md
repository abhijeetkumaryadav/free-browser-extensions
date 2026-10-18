# Thumbnail A/B Studio v1.0.0

Compare two video thumbnails side-by-side with a best-practice checklist and an on-device test log.

## What it does

- **Upload two thumbnails** (A and B) — previewed at YouTube-card size, side-by-side, plus a zoomed comparison view. Swap or clear anytime.
- **Best-practice checklist per variant** (all client-side, all your own judgment):
  - **Overlay text** — type the words on your thumbnail; ≤4 words passes the classic readability heuristic.
  - **Face visible** — toggle whether a face is present.
  - **Contrast** — measured automatically via canvas RMS luminance contrast; ≥35% passes.
  - Live pass count per variant (e.g. 2/3 passing).
- **Test log** — save tests with a title, winner pick (A / B / Tie), and notes; stored on-device, copyable as a summary, deletable.

**Honest scope:** this is a *manual comparison aid*. It does not measure or predict click-through rate — no extension can. Pick the winner with your own judgment.

## Install

**Chrome / Edge**
1. Unzip `video-thumbnail-ab-test-previewer.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`. (Temporary until signed via AMO.)

**Opera**: same as Chrome via `opera://extensions`.

## Permissions

- `storage` — saves your test log locally. Justification: the test log must persist between popup opens.
- `clipboardWrite` — "Copy summary" button. Justification: one-click copy of your test log.

No host permissions, no network calls. Uploaded images are read via in-memory object URLs and never leave your device.

## Publishing notes

- MV3 only, no deprecated APIs.
- Privacy: 100% client-side; declare "no data collected" in store listings.
- Screenshots: show the side-by-side comparison and checklist for the listing.
