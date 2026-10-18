# TabWav — Tab Audio to WAV Capture

Record the **active tab's audible output** and export it as a standard
16-bit PCM `.wav` file. Everything runs locally on your device — no network
calls, no accounts, no servers.

## How it works

1. Open the tab that is playing audio.
2. Click the TabWav toolbar icon, then **Start recording** (this explicit
   click is what authorizes the capture).
3. Watch the live level meter and timer. **Keep the popup open** while
   recording — closing it stops the capture and releases the stream.
4. Press **Stop**. The recording is decoded and re-encoded to WAV locally.
5. Press **Download .wav** (or Discard).

## Honest scope

- **Tab audio only.** Uses `chrome.tabCapture` on the active tab. It cannot
  record your microphone, other tabs, or system audio.
- **No background recording.** Capture starts only when you press Start and
  stops when you press Stop or close the popup. A pulsing red dot in the
  popup shows recording state at all times.
- **Local WAV encoding.** The tab stream is recorded as WebM/Opus, then
  decoded and re-encoded to 16-bit PCM WAV entirely in the popup's
  JavaScript. Nothing leaves your device.
- Restricted pages (`chrome://`, `edge://`, `about:`, extension pages)
  cannot be captured — the popup will tell you.

## Consent

Only record audio you have the right to record. Recording someone else's
audio without permission may be illegal where you live.

## Permissions

| Permission | Why |
|---|---|
| `tabCapture` | Capture the active tab's audio stream after you click Start. |
| `activeTab` | Identify the active tab so capture targets the right one. |
| `storage` | Reserved for future settings (currently unused beyond defaults). |

## Install (developer mode)

- **Chrome / Edge:** unzip → `chrome://extensions` → Developer mode →
  Load unpacked → select this folder.
- **Firefox:** not supported — Firefox does not implement `chrome.tabCapture`
  for tab audio. (The popup will show an error if capture is unavailable.)
- **Opera:** same steps as Chrome via `opera://extensions`.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI, meter, recorder, WAV encoder
- `icons/` — 16/48/128 PNG icons (generated)

## Publishing notes

- MV3, no remote code, no analytics, no network.
- Store reviewers: the extension requests `tabCapture`, which triggers the
  standard capture permission flow; recording is strictly user-initiated.
