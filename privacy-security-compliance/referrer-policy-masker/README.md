# Referrer Policy Masker v1.0.0

Privacy extension that enforces a strict referrer policy on every page you visit, so
sites learn less about where you came from.

## What it does

- **Two policy modes** (your choice):
  - **No referrer** — forces `Referrer-Policy: no-referrer` on every document and
    strips any `Referer` request header. Maximum privacy.
  - **Origin only** — forces `Referrer-Policy: origin`, so sites see only the domain
    (`https://example.com`), never the full URL path.
- Implemented with `declarativeNetRequest` header rules — no page-content access needed.
- Popup shows live status, the active mode, and a same-session counter of outgoing
  requests observed while masking is on (counted passively; nothing is logged).
- Fully reversible: flip the toggle off and the browser behaves normally again.

## Install

**Chrome / Edge**
1. Unzip `referrer-policy-masker.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox** — temporary load via `about:debugging#/runtime/this-firefox` (note:
`declarativeNetRequest` header modification is Chromium-first; behavior may vary).
**Opera** — same steps as Chrome via `opera://extensions`.

## Permissions (all justified)

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Apply the `Referrer-Policy` response header and strip `Referer` request headers |
| `webRequest` | Passively count outgoing requests for the session counter (non-blocking, read-only) |
| `storage` | Remember your toggle/mode choice and the session counter |
| `host_permissions: <all_urls>` | Header rules must be able to match requests to any site you visit |

## Privacy

All settings stay in `chrome.storage.local` on your device. No analytics, no network
calls, no data leaves the browser.

## Publishing notes

- Manifest V3, no remote code, no deprecated APIs.
- Minimal, justified permissions; host permission is inherent to the feature (privacy
  header enforcement must cover every site).
