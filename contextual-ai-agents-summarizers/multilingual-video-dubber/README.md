# Multilingual Video Dubber v1.0.0

**Caption toolkit for language learners.** On a page with a video
you're watching, it detects the video's existing caption/subtitle
tracks (with languages), extracts the caption text, exports it as a
proper `.srt` file, and builds a word-frequency vocabulary list from
the dialogue.

**Honest scope:** this reads captions that already exist on the
video. It does **not** generate AI dubbing audio, translate speech,
or create subtitles where none exist. Some sites use custom caption
players that can't be read — the popup says so when that's the case.

## Try it
1. Unzip `multilingual-video-dubber.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
   (Edge: `edge://extensions`. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.)
3. Open a video page with captions → click the icon → **Scan page** → **Extract** a track → **Export .srt**.

## Permissions
- `activeTab` + `scripting` — read the caption tracks of the video on the page you're viewing. Nothing is read from other tabs, and nothing is uploaded anywhere.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration, 2-step verification, MV3 listing with privacy disclosure (no data collected).
- Edge Add-ons: free account. Firefox Add-ons: free, requires signed build.
