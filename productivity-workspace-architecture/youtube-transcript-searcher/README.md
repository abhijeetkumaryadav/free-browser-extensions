# YouTube Transcript Searcher v1.0.0

Searchable transcript for the YouTube video you're watching. Pick a caption track, search the text, and click any line to jump the video to that moment.

## Features

- **Caption track picker** — lists the video's published and auto-generated caption tracks (manual captions shown first).
- **Full searchable transcript** — timestamps, live search with match highlighting and hit counts.
- **Click-to-seek** — clicking any line jumps the video to that timestamp.
- Works entirely on-device; captions come from YouTube's own public caption endpoints for the video you're watching.

## Install

**Chrome / Edge**
1. Download and unzip `youtube-transcript-searcher.zip`.
2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.
2. Note: the MAIN-world caption probe uses `world: "MAIN"` in `chrome.scripting.executeScript`, which is Chromium-only; Firefox support would need a page-script fallback.

**Opera** — same steps as Chrome via `opera://extensions`.

## How it works

1. Open any YouTube watch page, then click the extension icon.
2. The popup reads the video's caption track list from the page's own player data (via a tiny probe injected into the page's main JS world).
3. Choose a track — the content script downloads that track's public timedtext captions (same-origin request to YouTube) and renders the transcript.
4. Type to search; click a line to seek.

## Honest limitations

- Only works on videos that actually have captions (published or auto-generated). If a video has none, the popup says so.
- Does not work on `youtube.com` pages other than `/watch` (Shorts, embeds, channel pages).

## Permissions (all justified, minimal)

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab's URL to confirm it's a YouTube watch page, and message the content script there. |
| `scripting` | Inject the MAIN-world caption probe and the content script only when you open the popup on a YouTube video page. |
| `storage` | Reserved for future per-video preferences; no browsing data is uploaded anywhere. |

No remote code, no analytics, no data leaves your device. Caption text is fetched from YouTube's own public endpoints for the video you're already watching.

## Publishing notes

- Chrome Web Store: single-purpose, minimal permissions; declare the YouTube caption use in the privacy disclosure ("reads caption data on youtube.com watch pages you open").
- No host permissions are requested — the content script's caption fetch is same-origin with the YouTube page.
