# YouTube Chapter Generator v1.0.0

Build YouTube-ready chapter lists — by hand, honestly. This tool
does **not** auto-generate chapters (no AI, no guessing). On a
YouTube watch page it can **import existing chapters** from the
video description, then you edit timestamp/title markers, get live
validation (first marker at 00:00, 3+ chapters, ascending order),
preview the description-ready list, and copy it to paste into your
description. Drafts are saved per video on-device.

## Try it
1. Unzip `youtube-chapter-generator.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode →
   **Load unpacked** → select the folder. In Firefox: `about:debugging`
   → This Firefox → Load Temporary Add-on → select `manifest.json`.
3. Open any YouTube watch page, click the icon, hit **Import** (or
   build markers manually), then **Copy chapter list**.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read the YouTube page's
  video data only when you click Import), `storage` (per-video
  drafts), `clipboardWrite` (Copy button). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee.
