# Outbound Link Tracker Stripper

Privacy helper that strips tracking parameters (`utm_*`, `gclid`, `fbclid`,
`msclkid`, and ~30 more) from links **you click**, before navigation happens.
The page's DOM is never rewritten — only your click's destination is cleaned.

## What it does

- Content script intercepts plain left-clicks on links (capture phase) and
  removes known tracking query params from the destination URL.
- Modified clicks (Ctrl/Cmd+click, middle-click, right-click) are left
  completely untouched.
- Popup shows a live session counter (params stripped), most-cleaned sites,
  a global on/off toggle, and a per-site toggle for the open tab.
- Only `http:`/`https:` URLs are processed; `mailto:`, `javascript:`, etc.
  are ignored.

## Honest limitations

- Some sites require their tracking params to function (rare); use the
  per-site toggle to exempt them.
- Affiliate IDs in the URL *path* (not query params) are intentionally left
  alone — this tool only cleans query parameters.

## Install (development)

**Chrome / Edge:**
1. Unzip `outbound-link-tracker-stripper.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder.
3. Note: temporary add-ons unload on browser restart.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `storage` | Persist the global toggle and per-site disable list on-device. |
| `activeTab` | Read the current tab's hostname so the popup can offer a per-site toggle. |
| Content script on `http(s)://*/*` | Intercept link clicks to clean tracking params. Nothing is read or sent. |

## Privacy

All processing is on-device. No analytics, no network calls, nothing leaves
your machine. The counter resets when the browser restarts.

## Publishing notes

- Chrome Web Store: one-time $5 developer registration; disclose the content
  script's purpose ("removes tracking query parameters from links the user
  clicks") in the privacy section.
- Edge Add-ons: similar disclosure; free account.
- Firefox Add-ons (AMO): host-pattern content scripts are routine; explain the
  click-interception behavior in reviewer notes.
