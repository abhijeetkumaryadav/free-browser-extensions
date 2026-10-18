# FullShot — Full-Page Screenshot Grabber

Capture the entire scrollable page as one stitched PNG/JPEG. The extension
scrolls the active tab viewport by viewport with `chrome.tabs.captureVisibleTab`,
then stitches the tiles on a canvas inside the popup. Everything happens
locally — nothing is uploaded anywhere.

## Install (load unpacked)

1. Unzip `full-page-dom-canvas-screenshot-grabber.zip` anywhere.
2. **Chrome / Edge:** open `chrome://extensions`, enable **Developer mode**,
   click **Load unpacked**, pick the unzipped folder.
3. **Firefox:** open `about:debugging#/runtime/this-firefox` → **Load Temporary
   Add-on…** → pick `manifest.json`. (Note: Firefox's `captureVisibleTab`
   equivalent is not available to extensions, so capture may not work there —
   Chrome/Edge recommended.)
4. **Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Use

1. Open any page and click the FullShot toolbar icon.
2. Pick a settle delay (time between scroll and capture) and format.
3. Click **Capture full page** — keep the popup open while it works.
4. Preview the stitched image, then **Download PNG**.

## Permissions (justified)

- `activeTab` — capture the visible tab the user clicked on, and only then.
- `scripting` — measure page dimensions and scroll the page during capture.
- `storage` — remember your delay/format settings. Local only.

## Known limitations (honest)

- Scroll-and-stitch: fixed/sticky headers may repeat in the output.
- Cross-origin iframes capture as blank areas.
- `chrome://`, `edge://`, `about:` and extension pages are browser-restricted
  and cannot be captured.
- Very long pages can produce large images and take a while.

## Publishing notes

- MV3 only, no remote code, no network calls.
- No store-prohibited behavior: capture is strictly user-gesture-initiated.
