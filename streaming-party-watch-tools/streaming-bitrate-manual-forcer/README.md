# StreamGauge — Playback Quality Preference Manager

Set a preferred streaming quality per site, verify what the player actually delivers, and keep a verification log.

## What it does

- **Per-site preferences**: on any streaming site, pick your preferred quality (2160p down to 360p) and save it for that domain.
- **Check playback now**: injects a read-only probe (only when you click) that reads each `<video>` element's real dimensions via `videoWidth`/`videoHeight` plus `getVideoPlaybackQuality()` dropped/total frame counts.
- **Match / Mismatch verdicts**: compares the detected resolution against your preference for that site and logs the result with a timestamp.
- **Verification log**: history of checks across sites (capped at 100), with one-click clear.

**Honest scope:** browser extensions cannot force a streaming service's bitrate or quality — that choice lives inside each player's adaptive streaming logic. StreamGauge is read-only: it records your preference and tells you whether the player is honoring it, so you can change quality in the player's own settings.

## Install (Chrome / Edge)

1. Unzip the package and open `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

This build targets Chromium. Source is plain MV3 HTML/CSS/JS; porting needs only manifest tweaks.

## Permissions (justified)

- `activeTab` — know which site you're on and probe only the tab you're viewing.
- `scripting` — inject the tiny read-only quality probe on demand (never automatic).
- `storage` — persist site preferences and the verification log on-device.

No host permissions, no background page, no network calls at all. Nothing is modified on the page; everything stays on your device.

## Publishing notes

- MV3, no deprecated APIs.
- Read-only diagnostic tool with minimal permissions — suitable for the Chrome Web Store.
- Never claims to change streaming quality; all copy states the honest scope.
