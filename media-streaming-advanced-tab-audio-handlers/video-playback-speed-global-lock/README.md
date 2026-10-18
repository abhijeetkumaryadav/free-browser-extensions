# Speed Lock — Global Playback Rate

One playback speed for every HTML5 `<video>` and `<audio>` on the web.
Set a global rate (0.25×–4×), and the extension enforces it on all media —
including videos added later by SPAs and lazy players — via a
`MutationObserver`. While the lock is on, sites can't silently change the
speed back.

## Features

- **Global speed slider** (0.25×–4×) + one-tap presets (0.5×–2×)
- **Master on/off switch** — off restores normal site/player control instantly
- **Per-site overrides** — custom speed for the current site, or fall back to global
- **Lock behavior** — re-applies your rate if a page's script changes it
- **Reset all** — back to 1× everywhere in one click

Fully reversible: nothing is ever written to pages; only `playbackRate` is
set, and disabling the extension or the switch restores default behavior.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your global rate, master switch, and per-site overrides |
| `activeTab` | Read the current site's hostname for per-site overrides |
| Host access (`http/https`, content script) | Apply the locked speed to media on pages you visit |

No network calls. No data leaves the device.

## Install (development)

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
enable **Developer mode** → **Load unpacked** → select the unzipped folder.

**Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on →
select `manifest.json`.

## Publishing notes

- Manifest V3, no deprecated APIs, no remote code.
- Minimal, justified permissions (see table above).
- Icons: 16/48/128 PNG generated locally.
