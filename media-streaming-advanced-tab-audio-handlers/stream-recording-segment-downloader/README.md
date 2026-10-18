# StreamSaver — Media File Finder

Finds publicly accessible video and audio files on the current tab and lets you download them with one click.

## What it does

- Click the toolbar icon (or Rescan) to scan the active tab.
- Lists every direct media file found: `<video>` / `<audio>` elements, their `<source>` children, media links, and media resources loaded over the network.
- Shows file type, name, and size (via HEAD request where allowed).
- **Save** downloads the file via `chrome.downloads`; **copy** copies its URL. Nothing downloads unless you click.

## Honest limits

- **Segmented streams** (`.m3u8` / `.mpd` playlists) are deliberately skipped — no segment stitching.
- **DRM-protected video** cannot and will not be downloaded.
- `blob:` media is transferred through the page context (capped at 150 MB) so it can be saved.
- Cannot scan browser internal pages (`chrome://`, `edge://`, `about:`).

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Scan only the tab you are viewing, only when you click |
| `scripting` | Inject the scan probe into the active tab on demand |
| `downloads` | Save files you explicitly choose |
| `storage` | Reserved for future preferences (minimal use) |

No data leaves your device. No analytics, no remote servers.

## Install

1. Download and unzip `stream-recording-segment-downloader.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Firefox: open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. (`downloads` filename behavior may differ slightly.)

## Publishing notes

- Manifest V3, no deprecated APIs, no remotely hosted code.
- `downloads` + `activeTab` + `scripting` are standard for download-helper extensions; justify each in the store privacy questionnaire.
