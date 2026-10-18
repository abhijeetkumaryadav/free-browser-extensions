# QuietStart — Autoplay Sound Guard

Pauses videos that start playing **with sound** before you interact with the page — no more surprise blaring trailers or ads when a tab loads.

## Honest scope

This extension **cannot identify trailers or any specific video type**. It is an autoplay guard: any `<video>` that begins playing with audible sound before your first interaction (click, keypress, scroll) with the page gets paused. Muted autoplay is left alone, and you can press play yourself at any time.

## Features

- **Autoplay-with-sound guard** — pauses noisy autoplaying videos on any site (content script at `document_start` + `MutationObserver` for lazy/SPA players)
- **Master on/off toggle** — instant enable/disable from the popup
- **Per-site allowlist** — add the current site; allowed sites are never paused
- **Blocked-attempt counter** — shows how many noisy autoplays were paused
- **One-click resume** — "Resume paused video" plays back the video the guard paused (explicit user gesture)

## Install

**Chrome / Edge:**
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` from the unzipped folder.
   - Note: temporary in Firefox; for permanent install the add-on must be signed via addons.mozilla.org.

## Permissions — why each is needed

| Permission | Justification |
|---|---|
| `storage` | Persists the master toggle, allowlist, and blocked counter on-device |
| `activeTab` | Lets "Resume paused video" play the video on the tab you are viewing |
| `scripting` | Used only by the explicit resume button on the active tab |
| Host access (`http://*/*`, `https://*/*` content script) | Required to observe `<video>` `play` events on the pages you visit; the script only watches for play events and pauses unmuted autoplay — it never reads, stores, or transmits page content |

No data leaves your device. No network calls. No analytics.

## Notes / limitations

- The guard acts on `play` events with sound; a site that plays a video *after* you interact is left alone (that's your intent).
- `chrome://`, Web Store, and Firefox internal pages cannot be guarded (browser restriction).
- Videos the browser forces to start muted stay muted and are not touched.

## Publishing notes

- Chrome Web Store / Edge Add-ons: standard MV3 listing; declare the single purpose ("pause noisy autoplay videos") and the host-permission justification in the privacy tab.
- Firefox: requires AMO signing; the content script matches the minimum needed hosts.
