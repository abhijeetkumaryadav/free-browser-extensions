# Pomodoro Site Limiter v1.0.0

A Pomodoro timer with teeth: start a focus session and your blocklisted sites show a "back to focus" interstitial until the session ends. Breaks unlock everything.

## What it does

- **Pomodoro timer** — 25/5, 50/10, 15/3 presets plus custom lengths. Focus sessions auto-roll into breaks; phase-end notifications keep you on track. Session count is tracked.
- **Site blocklist** — add sites manually or block the current tab with one click. Subdomains are matched (blocking `example.com` also covers `www.example.com`).
- **Focus interstitial** — during a focus session, visiting a blocked site shows a full-page "Back to focus" overlay with the remaining session time. Non-destructive and reversible: ending the session or removing the site restores normal browsing. Breaks always unlock sites.
- **100% on-device** — no accounts, no network, no analytics.

## Install (development)

**Chrome / Edge**
1. Download and unzip `pomodoro-site-limiter.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select the unzipped folder's `manifest.json`. (MV3 is supported in Firefox 109+; content scripts on `http://*/*` work the same.)

## Permissions (all justified)

| Permission | Why |
|---|---|
| `storage` | Save session state, blocklist, and preferences on-device. |
| `alarms` | End focus/break phases on time, even with the popup closed. |
| `notifications` | Alert when a focus session completes or a break ends. |
| `activeTab` | Read the current tab's URL only when you click "This site" to block it. |
| Content scripts on `http://*/*`, `https://*/*` | Render the interstitial overlay — only when a focus session is active and the site is on your blocklist. The script does nothing otherwise. |

## Publishing notes

- MV3 only, no deprecated APIs.
- For the Chrome Web Store listing, disclose: "No data collected; everything stored locally. Interstitial only appears on user-blocklisted sites during user-started focus sessions."
