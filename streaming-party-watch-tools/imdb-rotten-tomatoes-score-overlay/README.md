# ScoreScout — IMDb & Rotten Tomatoes Lookup Helper

One-click score lookups for the title on any page, plus a manual score log with CSV export.

## What it does

- **Detect from tab**: reads the current page's metadata (`og:title`, headings, `document.title`) and cleans it into a likely movie/show title. Injected only when you click the button, in the page's MAIN world so it sees exactly what the page declares.
- **Search IMDb / Search RT**: opens IMDb and Rotten Tomatoes search-result pages for the title (plus optional year) in new tabs. These are the only network calls the extension ever makes, and only when you click.
- **Score log**: record scores you looked up manually (title, IMDb /10, RT %, auto date). Entries persist in `chrome.storage.local`. Delete individual entries, export everything as CSV.

**Honest scope:** there is no public IMDb or Rotten Tomatoes score API for extensions, so this is a lookup helper + manual log — it never fetches scores itself.

## Install (Chrome / Edge)

1. Unzip the package and open `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

Firefox uses its own packaging; this build targets Chromium. Source is plain MV3 HTML/CSS/JS — porting requires only manifest tweaks (`browser` namespace works as-is in most of `popup.js`).

## Permissions (justified)

- `activeTab` — read the current tab's URL/title so "Detect from tab" knows which page to probe. Nothing is read until you click.
- `scripting` — inject the tiny title probe into the active tab on demand.
- `storage` — persist your manual score log on-device.

No host permissions, no background page, no remote code, no analytics. All data stays on your device.

## Publishing notes

- MV3, no deprecated APIs.
- Single-purpose, minimal permissions — suitable for the Chrome Web Store.
- The extension never scrapes IMDb/RT; it only opens their public search pages at your request.
