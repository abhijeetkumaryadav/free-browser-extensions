# PagePack — Single-File Page Saver

Save any web page as a single self-contained file, in one click.

## What it does

- **`.mhtml` mode** — uses `chrome.pageCapture.saveAsMHTML` for a browser-native snapshot. Most faithful; opens in Chrome/Edge.
- **`.html` mode** — serializes a cleaned clone of the page into one file:
  - same-origin stylesheets inlined as `<style>`,
  - images optionally inlined as data URIs (3 MB per-image cap, best-effort),
  - all `<script>` / event-handler attributes removed,
  - a `<base>` tag keeps relative links working.
- Custom file name, remembers your last format + image preference (on-device only).
- Shows honest warnings when a stylesheet or image could not be inlined.

## Honest limits

- JS-heavy single-page apps may not round-trip perfectly — the saved file is a static snapshot.
- Cross-origin images blocked by CORS keep their remote URLs instead of inlining.
- Cannot save browser internal pages (`chrome://`, `edge://`, `about:`).
- Firefox supports `.html` mode; `pageCapture` MHTML is Chromium-only.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read only the tab you are saving, only when you click Save |
| `scripting` | Inject the serializer into the active tab on demand |
| `downloads` | Save the file you asked for |
| `pageCapture` | Produce the `.mhtml` snapshot |
| `storage` | Remember format / image preferences on-device |

No data leaves your device. No analytics, no remote servers.

## Install

1. Download and unzip `single-html-page-packager.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json` (HTML mode only).

## Publishing notes

- Manifest V3, no deprecated APIs, no remotely hosted code.
- `pageCapture` is a low-risk permission; declare it plainly in the store privacy questionnaire.
