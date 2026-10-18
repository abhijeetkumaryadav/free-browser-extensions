# Telemetry SRT Builder

Honestly narrowed: **subtitle generator — not video muxing.** This extension lets you
type timed telemetry lines (start time + text) and generates a standard `.srt`
subtitle file you can download and attach to a video in a video editor. It cannot
overlay anything onto video itself.

## What it does

- Enter a start time (hh:mm:ss,mmm — also accepts seconds or mm:ss), duration, and text
- Add cues; they sort by start time automatically
- Live .srt preview
- Download a valid `.srt` file
- Cues persist locally (chrome.storage.local)

## Privacy

Fully local. Zero network requests. No accounts, no telemetry.

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder
