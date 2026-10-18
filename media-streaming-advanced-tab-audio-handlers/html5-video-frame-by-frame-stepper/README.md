# FrameStep — Video Frame-by-Frame Stepper

Pause any HTML5 video and step forward/back one frame at a time, with a live
timestamp + frame-number readout and one-click PNG frame capture.

## Features

- **Frame stepping** — seeks by exactly 1/fps second (24/25/30/60 fps selectable)
- **Live readout** — current timestamp, computed frame number, play/pause state
- **Keyboard shortcuts** — `,` step back, `.` step forward (work on the page when not typing)
- **Capture frame as PNG** — downloads the current frame via the `downloads` API
- **Smart video picking** — tracks the video you last interacted with; falls back to the largest visible video

## Install (developer mode)

**Chrome / Edge**
1. Unzip `html5-video-frame-by-frame-stepper.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`

**Opera** — same steps as Chrome via `opera://extensions`.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab's URL/title and grant one-time script injection when you open the popup |
| `scripting` | Inject `stepper.js` on demand to seek/pause the page's video — never runs without the popup |
| `storage` | Remember your fps step-size preference on-device |
| `downloads` | Save captured frames as PNG (only when you click Capture) |

No host permissions, no background page, no network calls. All processing is
on-device; nothing is uploaded.

## Notes & limitations

- Works on regular web pages with `<video>` elements. Cannot inject into
  `chrome://`, `edge://`, `about:`, or web-store pages (browser restriction —
  the popup shows "unavailable").
- Frame accuracy depends on the video's keyframe structure; the extension uses
  the `seeked` event so the readout reflects the actual landed position.
- Capture uses `canvas.drawImage` — DRM-protected video (e.g. Netflix/Prime)
  will produce a black frame; this is a platform restriction, not a bug.

## Publishing notes

- Manifest V3, no deprecated APIs.
- No remote code: all scripts are bundled.
- Store listing: category "Developer Tools" or "Accessibility"; disclose that
  frame capture downloads a PNG on user click.
