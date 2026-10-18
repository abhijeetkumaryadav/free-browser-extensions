# Tracker Pixel Detector v1.0.0

Find hidden tracking pixels, beacons and tracker domains on any web page.

## What it does
- Scans the current page for **1×1 tracking pixels**, **hidden images** (display:none, zero-opacity, offscreen), and resources loaded from **~40 known analytics/ad/tracker domains**.
- Shows a count, unique-domain count, and a per-item list with type badges (1×1 pixel / Hidden image / Tracker domain), riskiest first.
- Optional **"Hide detected pixels"** toggle removes flagged elements from view (fully reversible — toggle off to restore).
- Detection is heuristic and may include false positives; it is labeled as such in the UI.

## Install (load unpacked)
1. Unzip `tracker-pixel-detector.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`, Firefox: `about:debugging#/runtime/this-firefox`).
3. Enable **Developer mode**, click **Load unpacked**, select the unzipped folder.

## Permissions (minimal, justified)
- `activeTab` — read the tab you open the popup on, so the scan targets the page you're viewing.
- `scripting` — inject the scanner into the current page on demand (only when you open the popup).
- `storage` — remember your "hide pixels" preference.

Nothing is sent anywhere. All analysis happens on-device.

## Publishing notes
- Manifest V3, no remote code, no data collection — suitable for Chrome Web Store / Edge Add-ons / Firefox AMO review.
- Provide a privacy policy stating no data is collected.
