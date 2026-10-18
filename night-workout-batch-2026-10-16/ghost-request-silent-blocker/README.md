# GhostBlock — Silent Tracker Blocker

Silently blocks network requests to tracker/ad domains **you** choose, using
Chrome's `declarativeNetRequest` API. A defensive privacy tool — it blocks only
what you list and never touches first-party content.

## How it works

- On install, a **sample starter list** of well-known tracker domains is loaded
  (clearly labeled as sample data — edit it freely).
- The background service worker converts your list into dynamic DNR block rules
  (`||domain^` matches the domain and all subdomains). Top-level navigations are
  never blocked.
- Every blocked request is counted via `onRuleMatchedDebug`; the popup shows
  today/total counters and per-domain hit counts.
- Toggle the master switch to pause blocking without losing your list.

## Permissions

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Create the silent block rules |
| `declarativeNetRequestFeedback` | Count blocked requests for the stats |
| `storage` | Your domain list, toggle state, counters |
| `<all_urls>` host | Required so DNR can intercept requests to the domains you list |

No `webRequest` blocking, no content scripts, no remote code, no analytics —
everything is local.

## Honest scope

- The starter list is a **sample**, not a comprehensive tracker database.
  Add the domains you care about.
- Blocking is silent: pages won't show a notice, and occasionally a site may
  behave differently if it depends on a blocked domain — remove the domain or
  toggle GhostBlock off for that session.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open the popup, review the sample list, add/remove domains.

## Publishing notes

- Manifest V3, declarativeNetRequest only (no blocking webRequest).
- Icons generated locally (PIL); no third-party assets.
