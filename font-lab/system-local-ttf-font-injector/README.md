# FontStack — System Font Injector (v1.0.0)

Apply curated system font stacks to the current page. Pick a font from the
Universal web-safe, Windows, macOS or Linux groups — each entry shows a live
preview rendered in that stack — and one click applies it to the active tab.
One-click "Restore original fonts" removes every change.

## Honest scope

- **System fonts only.** Browser extensions cannot enumerate, browse or
  upload your local `.ttf` files, so this tool offers a curated list of
  common system font stacks instead. Everything renders with fonts already
  installed on your device; nothing is downloaded and nothing leaves the
  machine.
- A selected stack may fall back to another listed font if your OS doesn't
  ship the first choice — the preview shows the same fallback chain.

## Install (Chrome / Edge / Opera)

1. Unzip `system-local-ttf-font-injector.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

Firefox supports Manifest V3 extensions from `about:debugging#/runtime/this-firefox`
via **Load Temporary Add-on** (select `manifest.json`). `chrome.scripting`
requires the `scripting` permission grant; note Firefox's scripting support is
newer — Chrome/Edge recommended.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Apply/restore fonts on the tab you click in, only after your click |
| `scripting` | Inject a small self-contained stylesheet into the page's main world |
| `storage` | Remember which stack you last applied (on-device only) |

## Publishing notes

- No remote code, no network calls, no data collection — safe for the
  Chrome Web Store single-purpose policy.
- No bundled or remote fonts; all stacks reference fonts on the user's OS.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup
- `icons/` — 16/48/128 PNG icons (PIL-generated)
