# SubOverlay — Custom SRT Subtitle Player

Load your own `.srt` subtitle file and overlay it on any HTML5 video, synced to playback.

## Features
- **Load .srt files** — parsed 100% on-device with a built-in SRT parser
- **Synced overlay** — captions follow the video's playback time
- **Sync offset** — nudge subtitles ±100 ms per tap for perfect lip sync
- **Styling** — adjustable text size and background opacity
- **Enable/disable** — one tap, no page reload needed

## Honest scope
This extension plays back subtitle files **you provide**. It cannot fetch, translate, or auto-generate subtitles, and it does nothing until you load a file and enable the overlay.

## Install
1. Unzip the package.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → choose `manifest.json`.

## Permissions (why each is needed)
- `storage` — remembers your cues, file name, and display settings on-device
- `activeTab` — reads the current tab's video element when you enable the overlay
- `scripting` — injects the caption overlay into the active tab on demand

## Publishing notes
- Manifest V3, no remote code, no network calls, no analytics.
- Store review: declare that subtitles are user-provided files; no DRM circumvention is involved.
