# CropZoom — Video Aspect Ratio Crop & Zoom

Crop and zoom any HTML5 video with aspect-ratio presets (16:9 fill, 4:3, 1:1),
a custom zoom slider (100–300%), and pan offsets. Everything is CSS-only and
fully reversible — one click restores the video exactly.

## Features

- **Aspect presets** — Fit (reset), 16:9 fill, 4:3, 1:1, computed from the
  video's real dimensions (`videoWidth`/`videoHeight`)
- **Custom zoom + pan** — live sliders with debounced apply
- **Per-site memory** — optionally remembers your settings per hostname
- **One-click reset** — unwraps the video and restores original inline styles

## Install

**Chrome / Edge**
1. Unzip the release archive.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
   (Note: `chrome.scripting` APIs used here are Chromium-first; Firefox support
   is best-effort.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save per-site crop/zoom preferences on-device |
| `activeTab` | Access the video on the tab you are viewing, only when you click |
| `scripting` | Inject the crop/zoom helper into the active tab on demand |

No network requests. No data leaves your device. Cannot run on `chrome://`,
`edge://`, or Web Store pages (browser restriction).

## Notes & honest scope

- Targets the largest visible `<video>` on the page.
- The video is wrapped in an `overflow:hidden` box to clip the zoomed area;
  reset removes the wrapper and restores original styles.
- Sites that replace their `<video>` element dynamically may need re-applying.

## Publishing notes

- Manifest V3, no remote code, minimal permissions — store-friendly.
- Listing assets needed: 128px icon (included), screenshots, short + full
  description, privacy disclosure ("no data collected").
