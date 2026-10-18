# Yield — Cookie Consent Auto-Reject v1.0.0

Privacy-first cookie banner handler. Detects common consent banners
(OneTrust, TrustArc, Cookiebot, Didomi, Quantcast, Sourcepoint, Funding
Choices, …) and clicks an unambiguous **"reject"** button — never an
"accept" button.

## Safety contract

- A button is clicked **only if** it matches a reject pattern (e.g. "Reject
  all", "Necessary only", "Alle ablehnen", "Tout refuser", … — 30+ patterns
  across 10 languages) **and** does **not** match any accept-guard pattern
  ("Accept all", "Allow all", "Got it", "OK", …).
- If no unambiguous reject button is found, **nothing is clicked** — the
  attempt is logged as `no-safe-button`.
- After clicking, the extension verifies the banner actually disappeared.

## Features

- **Auto mode** — handles banners shortly after page load (configurable
  0–5s delay) plus a bounded 15s watch for late-injected banners
- **Manual mode** — only acts when you press "Scan this page now"
- **Per-site disable** — Yield does nothing on sites you exempt
- **Activity log** — every attempt with site, time, and outcome
- Master on/off switch; all settings and logs on-device only

## Install (development)

**Chrome / Edge:**
1. Unzip the release zip (or use this folder directly).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select this folder.

**Firefox:** Load via `about:debugging → This Firefox → Load Temporary
Add-on` (select `manifest.json`).

**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Settings (mode, delay, disabled sites) and the activity log — on-device |
| `activeTab` | Read the current tab's origin for per-site disable + "scan now" |
| `http(s)://*/*` content script | Detect and handle consent banners on web pages you visit |

No network calls are ever made by this extension. Nothing is uploaded,
tracked, or transmitted anywhere.

## Publishing notes

- MV3 only, no deprecated APIs, no remote code.
- Chrome Web Store: single-purpose privacy tool; the content script's purpose
  (clicking reject buttons on consent banners) must be described clearly in
  the listing and privacy justification.
- Honest limitation (also noted in code): some banners use multi-step flows
  ("Manage preferences → necessary only"); Yield only handles single-click
  reject buttons and will not guess through multi-step dialogs.
