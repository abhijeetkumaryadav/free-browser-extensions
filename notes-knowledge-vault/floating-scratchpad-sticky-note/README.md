# StickyPad — Floating Sticky Notes

Drop draggable, resizable sticky notes on any page. Notes persist per page URL, all on-device.

## Install

**Chrome / Edge**
1. Download and unzip `floating-scratchpad-sticky-note.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox** — MV3 support is growing; load via `about:debugging` → This Firefox → Load Temporary Add-on. `chrome.scripting` in Firefox requires the `scripting` permission (included); some behaviors may differ.

## Use

1. Click the StickyPad toolbar icon → **New note on this page**. A note appears (drag by header, resize by corner grip, pick a color dot, minimize or delete).
2. Notes save automatically as you type/move them — position, size, color, text, minimized state.
3. The popup lists **all notes** grouped by site, with jump-to-page and delete.
4. **Clear page** deletes every note on the current page.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist your notes on this device. |
| `activeTab` | Read the current tab's URL and attach the overlay only when you click. |
| `scripting` | Inject the note overlay on demand (never automatically on all pages). |

## Notes & limits

- Notes attach to the exact page URL; dynamic pages may shift. `chrome://` pages and the Web Store can't be scripted (browser restriction).
- 100% local — no network calls, no accounts, no sync.

## Publishing notes

- Store-safe: no remote code, no data collection. Declare the three permissions in the privacy questionnaire with the justifications above.
