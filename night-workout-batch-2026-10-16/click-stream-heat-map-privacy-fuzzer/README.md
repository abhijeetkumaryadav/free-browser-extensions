# Clickstream Heatmap — Local Click Visualizer

A **heatmap of your own real clicks** on the current page. Visual only.

## Honest scope (read first)

- Shows **only your real clicks** — clicks you actually made on the page.
- **Never generates fake clicks or fake traffic.** The original "fuzzer" concept was
  deliberately narrowed: generating synthetic clicks would be click fraud and could
  violate site terms, so this extension only *visualizes* real activity.
- Everything is stored in `chrome.storage.local`. **Zero network calls.**
- The click listener is injected only after **your explicit click** on "Track clicks
  on this tab" — nothing runs in the background, and the listener is page-bound
  (it disappears when you leave the page).
- Per-site opt-out: flip "Disable tracking for this site" and clicks on that
  hostname are ignored from then on.
- Delete your data anytime: "Clear this page" or "Clear everything".

## Features

- **Start tracking** — injects a lightweight click recorder into the active tab.
- **Click density overlay** — blurred radial blobs show where you click most.
- **Session stats** — clicks on this page, total clicks, pages tracked.
- **Per-site disable** — hostname blocklist stored locally.
- **Clear controls** — per-page or full wipe.

## What's recorded per click

`{ x, y, viewport/page size, element hint, timestamp }` — just enough to draw the
heatmap. Bounded to the last 2,000 clicks per page.

## Files

- `manifest.json` — MV3, permissions: `storage`, `activeTab`, `scripting`
- `popup.html` / `popup.css` / `popup.js` — 380px deep-dark glassmorphism UI
- `content.js` — click recorder (injected on explicit user click only)
- `heatmap.js` — heatmap overlay renderer (injected on explicit user click only)

## Install

1. `chrome://extensions` → enable Developer mode → Load unpacked → select this folder.
2. Open a page, click the extension, enable tracking, click around, then
   "Show heatmap overlay".

## Limitations

- Clicks recorded against the page size at click time are scaled proportionally
  if the page layout changes — an approximation, not survey-grade precision.
- The recorder does not survive navigation; enable tracking per tab session.
