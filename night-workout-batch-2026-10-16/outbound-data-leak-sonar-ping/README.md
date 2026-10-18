# Outbound Data Leak Sonar

A **defensive** privacy monitor. It watches outbound network requests from each
tab and shows a live "sonar" feed: which hosts your browser talks to, whether
each is first-party or third-party, and a red **TRACKER** ping when a request
hits a domain on your local tracker watchlist.

## Honest scope

- **Observe-only.** Uses `webRequest` in non-blocking mode. It never blocks,
  modifies, or redirects traffic.
- **No request bodies.** Only the request URL host and resource type are
  recorded — never POST data, headers, or page content.
- **100% local.** The feed, the tracker list, and the toggle all live in
  `chrome.storage.local` / worker memory. Nothing is uploaded anywhere.
- **Sample tracker list.** The bundled watchlist is a small starter set so the
  sonar has something to ping against. Edit it freely in the popup — a domain
  matches itself and all subdomains. "Not listed" is not a guarantee of safety.

## Permissions (justified)

| Permission | Why |
|---|---|
| `webRequest` | Observe outbound request URLs (non-blocking). |
| `<all_urls>` host | See request URLs on any site so first/third-party classification works. |
| `storage` | Persist the toggle + your tracker list. |

## Install (developer mode)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked**
2. Select this folder. Click the toolbar icon on any tab to open the sonar.

## Files

- `manifest.json` — MV3 manifest
- `background.js` — request observation, per-tab ring buffers, badge pings
- `trackers.js` — default (sample) tracker domain list
- `popup.html` / `popup.css` / `popup.js` — the sonar UI
- `icons/` — generated PNG icons (16/48/128)
