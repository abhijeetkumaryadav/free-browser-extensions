# Idle Tab RAM Hibernator v1.0.0

Set an idle threshold (default 30 minutes) and a background alarm
automatically hibernates tabs that have been idle longer than that
using `chrome.tabs.discard` — freeing RAM while keeping the tab
itself in place.

**No data loss, ever:** discarded tabs keep their URL and restore
on click. The active tab, pinned tabs, and whitelisted domains are
never touched.

Popup features:
- Enable/disable toggle, idle-minutes setting, "hibernate now" sweep
- Hibernated tab list with per-tab Wake and one-click **Wake all**
- Whitelist manager (type a domain or whitelist the current site)

## Install
**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
Developer mode → **Load unpacked** → select the folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary
Add-on** → select `manifest.json`. (Service-worker background and
`chrome.tabs.discard` work in Firefox MV3; `tab.lastAccessed` support
varies — the extension falls back to its own activity tracking.)

## Permissions
- `tabs` — read tab activity and discard idle tabs
- `storage` — settings, whitelist, and hibernated-tab list (on-device only)
- `alarms` — run the idle sweep once a minute

No network calls, no analytics, nothing leaves the device.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee; MV3 compliant.
- Declare the single purpose ("hibernate idle tabs") and justify
  `tabs` in the privacy disclosure.
