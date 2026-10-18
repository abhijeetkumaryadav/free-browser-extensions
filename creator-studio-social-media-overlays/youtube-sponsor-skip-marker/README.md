# Sponsor Segment Finder v1.0.0

On any YouTube watch page, looks up community-submitted sponsor segments via the public read-only SponsorBlock API and lets you jump to (or past) them.

## Features

- Lists sponsor, self-promo, interaction-reminder, intro, outro, preview, and off-topic-music segments with timestamps
- Click a row to seek the video to that timestamp
- Subtle color-coded marker bar overlaid on the player (toggleable)
- Category filters — choose which segment types to query
- **Read-only**: it never skips automatically, never modifies playback; clearly labeled as crowdsourced community data

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your category filters and marker-bar preference |
| `activeTab` / `scripting` | Reads the current tab's video ID and seeks the video when you click a segment |
| `https://sponsor.ajay.app/*` (host) | Queries the public read-only SponsorBlock API for the video being watched — nothing else |

No browsing data is sent anywhere except the video ID to the SponsorBlock API (required for the lookup).

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) → enable Developer mode → **Load unpacked** → select the folder.

**Firefox:** unzip → `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.

**Opera:** unzip → `opera://extensions` → enable Developer mode → **Load unpacked**.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Single-purpose: sponsor-segment lookup on YouTube watch pages only.
- Segment data is crowdsourced and accuracy varies — stated in the popup footer.
