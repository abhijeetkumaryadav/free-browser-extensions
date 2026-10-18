# HTTP Strict Upgrade Monitor v1.0.0

A **read-only** connection security monitor for the current tab. It shows the
page protocol (HTTPS/HTTP), scans for mixed-content subresources (http://
images, scripts, frames on an HTTPS page), warns about forms posting to
http:// and password fields on insecure pages, and renders a heuristic
security grade (A–F). Nothing is blocked, changed, or sent anywhere.

## Features
- Protocol badge (HTTPS/HTTP) for the active tab
- Mixed-content counts: images, scripts, frames, other subresources
- Insecure form detection (forms posting to http://)
- Password-field-on-HTTP warnings
- Heuristic A–F security grade with plain-language warnings
- Re-scan button

## Install
**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
enable Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`.
**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions
- `activeTab` — read the current tab's URL and run the one-shot scan only when
  you open the popup. No persistent host access.
- `scripting` — execute the read-only scan function in the active tab.
- `storage` — reserved for future preferences; no user data is stored in v1.

## Publishing notes
- MV3, no remote code, no network calls, no analytics, no data collection.
- The grade is heuristic and the UI states it is not a security audit.
