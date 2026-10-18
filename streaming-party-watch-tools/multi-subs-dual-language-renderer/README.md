# DualSubs — Dual-Language Subtitle Renderer

Render **two user-provided `.srt` subtitle tracks** over any HTML5 video, synced to
playback — e.g. English (large) + your target language (small). Great for language
learning while watching.

## Features

- Load two `.srt` files; parsing happens 100% on-device
- Overlay follows the largest video on the page and syncs to `currentTime`
- Per-track sync offset (±2000 ms) for out-of-sync subtitles
- Font size + caption background opacity controls
- Enable/disable toggle; one-click clear
- Subtitle contents are never stored — only style settings persist

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → enable *Developer mode* →
*Load unpacked* → select the folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* →
select `manifest.json`. (Temporary until signed via AMO.)
**Opera:** `opera://extensions` → enable *Developer mode* → *Load unpacked*.

## Permissions (justified)

| Permission | Why |
|---|---|
| `activeTab` | Attach the overlay to the video in the tab you click on |
| `scripting` | Inject the overlay script on demand (only when you click *Attach*) |
| `storage` | Remember your style settings between sessions |

## Honest scope

- Works only with subtitle files **you** provide. It does not fetch, translate,
  or auto-generate subtitles (no OCR, no network calls at all).
- Overlay attaches to the largest visible `<video>`; sites that render their own
  custom caption layers are unaffected.
- Cannot run on `chrome://` pages or the Chrome Web Store.

## Publishing notes

- Manifest V3, no remote code, no data collection — straightforward for the
  Chrome Web Store / Edge Add-ons privacy review.
- Firefox: `scripting.executeScript` is supported in MV3; submit for signing.
