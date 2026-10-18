# PrintPeek — Print Stylesheet Tester

Preview how a page looks with print styles applied, right in the tab.

## What it does

- **Apply print simulation** — injects a single removable `<style>` tag into
  the active tab that mimics print output: white page, dark ink, no shadows,
  with options to hide navigation/sidebars, hide cookie banners/popups/ads,
  and print link URLs after links (classic print-CSS behavior).
- **Remove print simulation** — deletes the injected stylesheet exactly,
  restoring the page.
- **Real print preview** — opens the browser's actual print dialog for the
  tab, for the genuine print-engine rendering.

## Honest scope

This is a **simulation, not the real print engine**. It cannot replicate
`@media print` rules already in the page, pagination, or the browser's print
layout. It is a quick eyeball check for print readability. The popup says
this plainly, and the "Real print preview" button is one click away.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Target the tab you clicked the extension on. |
| `scripting` | Inject/remove the one simulation `<style>` tag (user gesture only). |
| `storage` | Remember your simulation options. |

No network calls. Nothing leaves your device.

## Install (developer mode)

- **Chrome / Edge / Opera:** unzip → `chrome://extensions` (or
  `opera://extensions`) → Developer mode → Load unpacked → select this folder.
- **Firefox:** same steps via `about:debugging`; `chrome.scripting` maps to
  `browser.scripting` — the popup uses the `chrome` namespace which Firefox
  supports for these APIs.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI; injected functions are
  fully self-contained (function + args, no popup-scope references)
- `icons/` — 16/48/128 PNG icons (generated)

## Publishing notes

- MV3, no remote code, no analytics, no network.
- Restricted pages (`chrome://`, `about:`, extension pages) are refused with
  a clear message instead of failing silently.
