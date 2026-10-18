# Alt Text Gap Finder

Find images missing alt text on any page. Overlays styled placeholder badges showing each image's **filename and rendered dimensions**, and drafts a **heuristic alt-text starting point from the filename only** — clearly labeled, never presented as AI vision.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder

## How to use

1. Open any webpage and click the extension icon.
2. Click **Scan page** — the content script audits every `<img>`, `<input type="image">`, and `[role="img"]`.
3. Each offending image gets a dashed-emerald badge with filename + dimensions + buttons to **Suggest alt** (shows the filename heuristic), **Copy suggestion**, or **Dismiss**.
4. The popup lists every issue with its heuristic draft; **Copy draft** puts it on your clipboard, **Export report** downloads JSON.
5. **Clear badges** removes all overlays.

## What counts as "missing"

- No `alt` attribute at all → flagged
- `alt=""` (empty) on a rendered image → flagged as "empty"
- Images with `alt` text or `aria-label`/`aria-labelledby` → skipped
- Images smaller than 2×2px, `display:none`, or `visibility:hidden` → skipped

## Permissions

- `activeTab` + `scripting` — inject the scanner into the current page only when you click Scan. No broad host access.
- `storage` — reserved for future settings persistence.

## Honest scope

- Suggestions are derived **only from the filename** (split on separators, strip hashes/dimensions, title-case). They are a starting point, **not image analysis**.
- Everything runs locally. No network requests, no analytics, no data leaves the device.

## Publishing notes

- No remote code, no external resources — MV3 compliant.
- The content script only activates on explicit user action.
