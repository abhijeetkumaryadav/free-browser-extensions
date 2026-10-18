# Header Tamper Notifier

A **defensive** security tool: it observes the response headers of pages you visit
and notifies you when security headers are missing or suspiciously weak.

## Honest scope

- **Observe + notify only.** This extension never modifies headers, never blocks or
  alters traffic, and never sends data anywhere.
- Findings are **heuristic** — a flagged header is a prompt to investigate, not proof
  of an attack or compromise.

## What it checks (main-frame responses)

- `Strict-Transport-Security` — missing on HTTPS, short `max-age`, missing `includeSubDomains`
- `Content-Security-Policy` — missing, or weakened with `unsafe-inline` / `unsafe-eval` / wildcards
- Clickjacking — missing `X-Frame-Options` and no CSP `frame-anchors`
- `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- `Server` banner version disclosure
- `Set-Cookie` without `Secure` / `HttpOnly` on HTTPS
- Conflicting duplicate security headers (possible injection/misconfiguration)

The toolbar badge shows the warning count for the active tab. The popup shows the
per-page report with severity filters and the raw response headers.

## Permissions

- `webRequest` — read response headers (non-blocking, observe-only).
- `<all_urls>` host permission — needed to observe headers on any page you visit.
- `storage` — reserved for future settings (currently minimal use).

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Browse normally; reload a page to analyze its headers.

## Notes

- Reports live in the service worker's memory and regenerate on each navigation.
- Development build: logic validated statically; not yet tested in a live browser.
