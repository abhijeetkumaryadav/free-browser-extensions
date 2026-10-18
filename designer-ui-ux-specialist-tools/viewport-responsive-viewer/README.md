# Viewport Responsive Viewer v1.0.0

Responsive design checker: see your current tab's live viewport size, where it falls on the breakpoint spectrum, and preview the page at device widths (375 / 768 / 1024 / 1440) — plus a full side-by-side comparison page.

## Features
- **Live viewport readout** — width × height × devicePixelRatio of the active tab, refreshed every 2 seconds.
- **Breakpoint bar** — XS / SM / MD / LG / XL zones with a marker showing where the current width falls.
- **Device previews** — one-tap scaled iframe previews (Mobile 375, Tablet 768, Laptop 1024, Desktop 1440) plus a custom width × height option. Last-used device is remembered.
- **Full comparison page** — click the expand icon (or open via extension options) for all four breakpoints side by side with per-frame reload and a URL bar.

## Install
**Chrome / Edge:** unzip → `chrome://extensions` → enable Developer mode → Load unpacked → select the folder.
**Firefox:** unzip → `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.
**Opera:** unzip → `opera://extensions` → Developer mode → Load unpacked.

## Permissions (justified)
| Permission | Why |
|---|---|
| `storage` | Remember last-used device preset and comparison URL. |
| `activeTab` | Read the current tab's URL/host for previews (only when you click the extension). |
| `scripting` | Inject a tiny probe to measure the active tab's `innerWidth/innerHeight` — nothing else. |

No host permissions, no network calls, no data leaves the device. Preview iframes are sandboxed (`allow-scripts allow-same-origin allow-forms`) so they cannot navigate your tabs.

## Honest limitations
- Sites that send `X-Frame-Options` or CSP `frame-ancestors` headers block framing — their previews appear blank. That is the site's choice, not a bug.
- Viewport measurement doesn't work on browser-internal pages (`chrome://`, `about:`) — scripting can't run there.
- Previews are read-only; interactions inside a preview don't affect your real tab.

## Publishing notes
- MV3, no deprecated APIs. Minimal justified permissions.
- Chrome Web Store: one-time $5 developer registration + 2-step verification; disclose the three permissions above.
- Edge Add-ons and Firefox Add-ons: free accounts; Firefox requires add-on signing (automatic on upload).
