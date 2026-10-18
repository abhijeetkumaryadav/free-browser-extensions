# Plugin Conflict Detector

A guided binary-search troubleshooter for WordPress plugin conflicts.

## Honest scope

This extension **cannot reach your WordPress admin** — no browser extension can
deactivate plugins for you. Instead it acts as a smart companion for the classic
manual process:

1. **Describe the symptom** — what breaks, and when it started.
2. **List your active plugins** — with optional per-plugin notes.
3. **Binary search** — each round tells you exactly which half of the plugins to
   deactivate in WP Admin → Plugins. You test the site, then tap **Still broken**
   or **Fixed**. The suspect list halves every round.
4. **Report** — when one plugin remains, you get a copyable diagnosis report
   for your developer.

## Install

**Chrome / Edge**
1. Unzip the release archive.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
3. Note: temporary add-ons lose stored data on browser restart.

**Opera** — same steps as Chrome via `opera://extensions`.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your symptom, plugin list, notes, and bisect progress on-device so you can close the popup mid-diagnosis. |

No host permissions. No network calls. Nothing leaves your device.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Minimal permission footprint (`storage` only) — good for store review.
- Clearly labeled as a guided process, not an automated scanner, in both the
  UI and the store description (avoids misleading-functionality flags).
