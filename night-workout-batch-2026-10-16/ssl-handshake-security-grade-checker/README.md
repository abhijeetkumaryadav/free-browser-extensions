# HTTPS Hygiene Checker

A quick HTTPS hygiene check for the current tab: scheme verification plus a
mixed-content scan of subresources (scripts, images, styles, frames, media).

## Honest scope

- **Hygiene check only — not an SSL grade.** Browsers expose no TLS details
  (cipher suites, certificate chains) or response headers (HSTS, CSP) to
  extensions, so a true "security grade" is impossible here.
- Checks: (1) is the page itself HTTPS, (2) does it load any `http://`
  subresources. That is the whole check.
- Nothing runs until you click **Check this tab**. Internal pages
  (`chrome://`, `about:`) cannot be checked. 100% local, zero network.

## Verdicts

- **Looks clean** — HTTPS page, no insecure subresources found.
- **Mixed content found** — lists each insecure subresource with its tag/attribute.
- **Not HTTPS** — the page itself is plain HTTP.

## Permissions

- `activeTab` + `scripting` — inject the scanner into the tab you click on, only.
- `storage` — reserved for settings; nothing sensitive stored.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI and verdict rendering
- `content.js` — page-side scheme + mixed-content scanner (boot-once guard)
- `icons/` — 16/48/128 PNG icons
