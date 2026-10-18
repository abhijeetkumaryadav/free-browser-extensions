# Kaleidoscope — Mirror Camera Filter v1.0.0

Turn your camera feed into a live kaleidoscope. Fun, local-only, and honest about privacy: the camera is **off** until you press Start, nothing is recorded, and nothing is uploaded anywhere.

## Install (load unpacked)

**Chrome / Edge / Opera**
1. Unzip `kaleidoscope-mirror-camera-filter.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**: should work (uses standard `getUserMedia` in an extension page), but has not been tested in a live browser.

## How to use
1. Click the toolbar icon → **Open camera** (opens a full tab for the best effect).
2. Click **Start camera** and allow the browser's camera permission prompt.
3. Adjust the **Slices** slider (4–16) and toggle **Mirror slices** for different patterns.
4. Click **Snapshot PNG** to download the current frame.
5. Click **Stop camera** — tracks are stopped immediately. Closing the tab also stops the camera.

## Permissions
None. Camera access uses the standard web `getUserMedia` API inside the extension page; the browser shows its own permission prompt. No `storage`, no host access, no network calls.

## Publishing notes
- MV3, no remote code, no deprecated APIs, zero permissions.
- Store reviewers: camera activates only on explicit user gesture; a persistent "Local only · nothing leaves this tab" notice is shown while running.
