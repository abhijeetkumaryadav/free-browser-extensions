# Malicious Redirect Interceptor v1.0.0

Watches top-level navigation. If a page triggers a cross-domain redirect
(server redirect, meta refresh, or JS redirect) within seconds of loading,
navigation is paused with a warning interstitial showing where you came from
and where you were headed — **Continue anyway** or **Go back**. You always decide.

- **Heuristic detection** — legitimate redirects (SSO logins, URL shorteners)
  can trigger it. Add trusted domains to the whitelist in the popup.
- **Non-destructive & reversible** — the warning never modifies pages; both
  choices just navigate normally.
- **Nothing leaves your device.** No URLs or browsing data are transmitted.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
enable Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`. (Temporary until signed.)
**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions

- `webNavigation` — observe top-level navigation commits to detect redirect chains.
- `tabs` — show the warning page in the affected tab.
- `storage` — whitelist, enable toggle, and the on-device interception log.

## Publishing notes

- MV3, no remote code, no data collection.
- Chrome Web Store: one-time $5 developer registration + privacy disclosure
  ("does not collect user data"). Edge: free. Firefox: free, requires signing.
