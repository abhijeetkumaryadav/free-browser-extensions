# XHR Request Firewall v1.0.0

Per-site firewall for `fetch` / `XMLHttpRequest`: logs every outgoing request by
domain on the current tab and lets you **block the domains you choose** — e.g.
trackers, analytics, or ad pixels. Blocking is user-controlled, per-site, and
fully reversible.

## Features

- **Request log** — every fetch/XHR on the tab, grouped by domain with counts
- **One-click block / unblock** per domain; policy applies live, no reload needed
- **Blocked counter** on the toolbar badge
- **Live log** of recent requests with type (fetch/xhr) and timestamps
- Master on/off switch; everything stored on-device

## How blocking works

A small wrapper is injected into the page (MAIN world) at `document_start`.
It wraps `window.fetch` and `window.XMLHttpRequest`:

- Allowed requests pass through untouched (only logged).
- Blocked requests: `fetch` rejects with an `AbortError`; XHR `send()` becomes a
  no-op that fires an `error` event — the same way a network failure behaves,
  so pages degrade gracefully instead of throwing.

Domain matching is suffix-based: blocking `tracker.example` also blocks
`sub.tracker.example`.

## Install (development)

**Chrome / Edge:**
1. Unzip the release zip (or use this folder directly).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select this folder.

**Firefox:** MV3 `world: "MAIN"` injection is Chromium-only, so the blocking
wrapper is best-effort there; the popup still shows the page policy. Load via
`about:debugging → This Firefox → Load Temporary Add-on` (select `manifest.json`).

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Per-site block lists and the master switch, on-device only |
| `scripting` | Required for MV3 content-script policy refresh messaging |
| `activeTab` | Read the current tab's URL/origin in the popup |
| `http(s)://*/*` host access | Inject the request wrapper on web pages you visit |

No network calls are ever made by this extension. Logs live in memory only and
are discarded when the tab navigates or closes.

## Publishing notes

- MV3 only, no deprecated APIs.
- Chrome Web Store: single-purpose, minimal permissions; declare the host
  permission need in the privacy justification (observing page requests).
- Edge Add-ons: same package works unchanged.
- Firefox: see the MAIN-world caveat above; consider a Firefox-specific note
  in the listing description.
