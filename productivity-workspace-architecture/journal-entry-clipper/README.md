# Journal Entry Clipper v1.0.0

Capture selected text from any page (or the page title/URL when
nothing is selected) into a timestamped journal entry with tags and
a mood. Also available via right-click → **Clip to journal**.

Entries list supports full-text search, per-entry delete, and
one-click **Markdown** or **JSON** export.

## Install
**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
Developer mode → **Load unpacked** → select the folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary
Add-on** → select `manifest.json`. (MV3 + contextMenus supported;
`chrome.scripting` works in Firefox MV3.)

## Permissions
- `activeTab` + `scripting` — read the selected text of the page you clip
- `storage` — journal entries (on-device only)
- `contextMenus` — "Clip to journal" right-click item

No network calls, no analytics, nothing leaves the device.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee; MV3 compliant.
- Declare the single purpose ("clip text into a personal journal")
  and justify each permission in the privacy disclosure.
