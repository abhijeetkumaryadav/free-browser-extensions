# Clip Tagger — Timestamp Marker v1.0.0

Capture timestamps on YouTube videos, label them (Hook, Clip-worthy, Quote…),
and export your clip list as Markdown or CSV — perfect for repurposing long
videos into Shorts, Reels, and TikToks.

## Install
**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`.

## Use
1. Open any YouTube watch page.
2. Click the extension icon.
3. Hit **Capture current time**, pick a label, add an optional note.
4. Click a timestamp badge to seek the video back to that moment.
5. Export as **Markdown** (also copied to clipboard) or **CSV**.

## Permissions (all justified, minimal)
- `activeTab` — read the current tab's video player state only when you open the popup.
- `scripting` — run two tiny functions in the page: read `video.currentTime` / title, and seek the video. Never modifies page content.
- `storage` — save your timestamp lists on-device, keyed per video.
- `clipboardWrite` — copy the Markdown export to your clipboard.

## Privacy
Read-only page interaction. No accounts, no network calls, no analytics.
Everything stays on your device.

## Publishing notes
- MV3, no deprecated APIs. No remote code.
- Listing category: Productivity. Screenshots: capture card, clip list, export buttons.
