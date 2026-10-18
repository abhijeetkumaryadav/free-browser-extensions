# TrackTag — Soundtrack Spotter Log

A manual "what's this song?" log for anime, streams and videos.

## What it does

- One click logs the **current tab's title + URL** with a timestamp and your note (e.g. "opening theme, 12:40 mark").
- Each entry has quick-search buttons for **Spotify**, **YouTube** and **Google** — opened in new tabs.
- History with per-entry delete and clear-all. Everything stays on-device.

## Honest scope

This is a **manual log, not auto-identification**. Browser extensions have no audio-fingerprinting API, so TrackTag never claims to "hear" or identify music — it captures what you tell it to, when you hear something worth remembering.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your logged tracks on-device. |
| `activeTab` | Read the current tab's title/URL when you click "Log this track". |

No audio access, no network calls of its own — only the searches you explicitly click. No data leaves your device.
