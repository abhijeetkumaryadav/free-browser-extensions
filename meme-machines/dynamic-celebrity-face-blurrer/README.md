# FaceBlur — Manual Image Blur Tool

Manually blur or pixelate images on any web page. Click individual images to toggle a blur/pixelate overlay, adjust intensity, blur all images at once, or restore everything. Built for hiding faces (or anything else) in screenshots before sharing.

> **Honest scope:** this extension does **not** detect faces automatically. There is no face-detection model, no AI, and no network calls. You choose exactly which images to hide.

## Install (Chrome / Edge / Opera)

1. Unzip `dynamic-celebrity-face-blurrer.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

Firefox does not support `chrome.scripting.executeScript` the same way; the popup will report it cannot access the page. Chrome/Edge/Opera recommended.

## Usage

1. Click the FaceBlur toolbar icon.
2. Choose **Blur** or **Pixelate** and set the intensity slider.
3. Click **Pick images on page**, then click any image to toggle its blur. Press `Esc` to stop picking.
4. **Blur all images** hides every reasonably-sized loaded image; **Restore all** removes every overlay.
5. Blurs are **session-only** — reloading the page restores the original images. Nothing is uploaded anywhere.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Remembers your effect mode + intensity slider setting. |
| `activeTab` | Lets the popup act on the tab you clicked it from. |
| `scripting` | Injects the blur content script on demand, only after you click a button. |

No host permissions, no background page, no network access.

## Publishing notes

- Manifest V3, no remote code, no data collection → straightforward Chrome Web Store / Edge Add-ons review.
- The single-purpose description and honest "no face detection" labeling reduce policy risk.
- Privacy policy can state: "No data is collected, stored remotely, or transmitted."

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px popup UI
- `content.js` — on-demand page script (pick mode, blur/pixelate overlays)
- `icons/` — generated PNG icons (16/48/128)
