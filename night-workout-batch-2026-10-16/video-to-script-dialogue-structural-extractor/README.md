# Video to Script — Dialogue Structure Extractor

Extracts dialogue structure from videos by reading **captions and timed text the page already exposes**, segments them into script beats with timestamps, and exports a clean Markdown script outline.

## Honest scope

- ✅ Reads: YouTube player caption segments, elements with `data-start` / `data-begin` / `data-timestamp`, same-origin `<video>` text-track cues, and generic subtitle / caption / transcript containers.
- ❌ **NOT speech recognition.** It cannot transcribe raw audio. If the page exposes no captions, you will get an empty result — that means "no captions found", not "no speech".
- Speaker labels are detected heuristically from `Name:` prefixes; time gaps (>6s) also start new beats. Timestamps come from the captions themselves.

## Features

- One-click extraction from the active tab (injected on demand, click-only)
- Automatic segmentation into dialogue beats with `mm:ss` timestamps
- Speaker detection from caption labels
- One-click Markdown export (`script-outline.md`)
- 100% local — no network, no accounts

## Permissions

- `activeTab` — read captions from the tab you clicked on
- `scripting` — inject the extractor on demand only
- `storage` — reserved for future settings (minimal use)

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and beat segmentation
- `content.js` — caption collectors (YouTube, timed attributes, text tracks, containers)
- `icons/` — generated PNG icons (16/48/128)

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Open a video page with captions, click the extension, click **Extract dialogue**
