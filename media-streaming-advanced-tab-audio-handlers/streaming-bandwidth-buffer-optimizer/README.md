# Stream Health — Video Playback Optimizer

Diagnose choppy video with real numbers: per-video frame stats, a health grade,
and actionable fixes. Read-only — it never touches your streams.

## Features

- **Analyze videos on this tab** — reads `getVideoPlaybackQuality()` from each
  visible `<video>`: dropped vs. total frames, resolution, playback rate.
- **Health grades** — Good (<1% dropped), Fair (<5%), Poor (≥5%), with a
  drop-rate bar per video.
- **What to try** — tips tailored to what was measured (lower quality, close
  heavy tabs, pre-buffer, drop from >1.25× speed, disable conflicting
  extensions).

## Honest scope

This extension cannot control streaming bandwidth, change video quality, or
talk to your ISP — browsers don't expose those controls. It diagnoses, you fix.

## Install

**Chrome / Edge**
1. Unzip `streaming-bandwidth-buffer-optimizer.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox** — `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
pick `manifest.json`.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read video stats on the tab you clicked the icon on. |
| `scripting` | Run the one-shot read-only analysis when you click Analyze. |

No storage, no network calls, no background page. Everything stays on-device.

## Limitations (honest)

- Pages like `chrome://`, `edge://`, and the web stores can't be scripted.
- Some players throw on `getVideoPlaybackQuality()` — those videos show "—".
- Drop-rate data only exists while a video has been playing; a fresh page may
  show little data.

## Publishing notes

- MV3, no deprecated APIs. No remote code, no analytics.
- Chrome Web Store: single-purpose "video utilities"; `scripting` + `activeTab`
  justification is a user-initiated, read-only health check on the current tab.
