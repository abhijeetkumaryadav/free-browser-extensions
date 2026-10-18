# TabCast — Tab Video Recorder

Record the visible tab as a WebM video using `chrome.tabCapture` +
`MediaRecorder`. Strictly user-gesture-driven: **Start** and **Stop** are both
explicit clicks, and recording auto-stops at the chosen max duration.

**Honest scope: video only — this extension does NOT encode GIFs.** Real GIF
encoding in an MV3 extension is heavy and unreliable; the output is WebM
(VP9/VP8).

## Install (load unpacked)

1. Unzip `html5-video-gif-encoder-recorder.zip` anywhere.
2. **Chrome / Edge:** open `chrome://extensions`, enable **Developer mode**,
   click **Load unpacked**, pick the unzipped folder.
3. **Firefox:** not supported — Firefox lacks `chrome.tabCapture` for
   extensions, so this is Chrome/Edge/Opera only.
4. **Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Use

1. Open the tab you want to record and click the TabCast toolbar icon.
2. Choose a max duration (30 s / 60 s / 2 min) and whether to include tab audio.
3. Click **Start recording**. Keep the popup open — closing it stops the capture.
4. Click **Stop recording** (or let the timer cap it), preview the video, then
   **Download .webm**.

## Permissions (justified)

- `activeTab` — capture the visible tab the user chose to record, only then.
- `storage` — remember max-duration / audio settings. Local only.

## Known limitations (honest)

- WebM output only; no GIF export.
- Closing the popup ends the recording (extension popups can't run in the
  background without a persistent page).
- Tab audio only — never the microphone.
- `chrome://`, web-store and other restricted pages cannot be captured.
- Chrome/Edge/Opera only (no `tabCapture` in Firefox extensions).

## Publishing notes

- MV3 only, no remote code, no network calls.
- Recording is strictly user-gesture-initiated with a hard duration cap.
