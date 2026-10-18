# NightFlip — Page Inversion Night Reader v1.0.0

An accessibility tool that flips the **current tab** into a night-reading mode with one click: a smart `invert + hue-rotate` CSS filter layer, with optional media protection (images/videos double-inverted so photos keep natural colors). One click restores the page exactly.

## Install (Chrome / Edge / Opera)
1. Download and unzip `webpage-color-inversion-night-reader.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

Firefox: the extension uses `chrome.scripting` via the standard MV3 API; `browser.scripting` supports `executeScript` the same way, but load it as a temporary add-on from `about:debugging` for testing.

## Permissions
- `storage` — remembers your intensity and media-protection settings locally.
- `activeTab` + `scripting` — injects the reversible filter style into the tab you explicitly activate, on your click only.

No network access. Nothing leaves your device.

## Honest scope
- CSS filter layer only; the page's DOM and content are never modified.
- Restricted pages (`chrome://`, Web Store, `about:`) cannot be styled by extensions — the toggle stays idle there.
- Media protection is a heuristic (double-inversion of common media selectors); heavily styled sites may show minor color quirks.

## Publishing notes
- MV3, no remote code, no analytics. Ready for Chrome Web Store review after real-browser testing.
