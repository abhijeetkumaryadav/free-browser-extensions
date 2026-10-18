# Tab Audio Channel Splitter & Mixer

Stereo tools for the current tab: **L/R balance**, **channel swap**, **mono mix**, and **per-channel mute** — processed live through a Web Audio graph.

## How it works

1. Click the toolbar icon and press **Enable mixer for this tab**.
2. The extension captures the tab's audio (`chrome.tabCapture`), mutes the tab's
   native output (so you don't hear raw + processed audio doubled), and routes
   the stream through a Web Audio graph:
   `source → splitter → per-channel gains → merger → speakers`.
3. Adjust balance, swap, mono, or mute channels — changes apply instantly.
4. Press **Disable mixer** to stop capture and restore the tab's normal audio.

## Honest scope & limitations

- **One tab at a time.** Enabling the mixer on a new tab stops it on the old one.
- **Capture restrictions:** `chrome.tabCapture` cannot run on browser-internal
  pages (`chrome://`, `edge://`, `about:`), the Web Store, or some DRM-protected
  media pages. The popup shows "Failed" in those cases.
- **Slight latency:** routing audio through Web Audio adds a small delay
  (typically tens of milliseconds). This is inherent to capture-based processing.
- **Mono mode:** "Mute L" silences the mono mix; "Mute R" has no effect in mono.
- Settings persist for the browser session only (`chrome.storage.session`).

## Install

**Chrome / Edge:**
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox / Opera:** `chrome.tabCapture` is a Chromium API. The extension loads
but capture is unavailable — the popup surfaces "Failed" gracefully.

## Permissions (all justified)

| Permission | Why |
|---|---|
| `tabCapture` | Capture the active tab's audio stream for processing. |
| `offscreen` | Run the Web Audio graph — MV3 service workers have no `AudioContext`. |
| `storage` | Persist mixer settings (session) and active-tab state. |
| `activeTab` | Identify the tab the mixer is enabled on. |

No network calls. No data leaves the device. No remote code.

## Publishing notes

- Chrome Web Store: declare the `tabCapture` + `offscreen` usage in the privacy
  tab ("audio is processed locally on-device, never transmitted").
- Single-purpose, minimal permissions — store-friendly.
