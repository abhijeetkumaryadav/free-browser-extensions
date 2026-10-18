# Audio Track Isolator

Switch audio language tracks on videos in the current tab — using the real
`HTMLMediaElement.audioTracks` API. Click **Scan videos**, pick a video, then
click a track to enable it and mute the others on that video.

## How it works

1. The popup injects `probe.js` into the page's **MAIN world** (via
   `chrome.scripting.executeScript`), because `video.audioTracks` is only
   visible to page-world JavaScript.
2. The probe serializes every `<video>` element's `AudioTrackList`
   (language, kind, label, enabled state) and reports back.
3. Clicking a track sets `track.enabled = true` on that track and `false` on
   all sibling tracks of the same video.
4. Nothing on the page is modified — no DOM changes, no overlays.

## Honest limitations

- Only videos that **expose** multiple audio tracks to the page can be
  switched. Many players (e.g. YouTube) manage audio internally and expose a
  single track — the popup will tell you when there is nothing to switch.
- Cannot run on browser-internal pages (`chrome://`, Web Store, `about:`).

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read/switch tracks only on the tab you clicked the extension on |
| `scripting` | Inject the probe into the active tab on demand |
| `storage` | Remember the last scan count (session convenience only) |

No network calls. No data leaves the device.

## Install (development)

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
enable **Developer mode** → **Load unpacked** → select the unzipped folder.

**Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on →
select `manifest.json`. Note: MAIN-world script injection is Chromium-first;
Firefox support is best-effort.

## Publishing notes

- Manifest V3, no deprecated APIs, no remote code.
- Minimal, justified permissions (see table above).
- Icons: 16/48/128 PNG generated locally.
