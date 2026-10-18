# PhishBarometer — One-Click Phishing Risk Check

A defensive, on-demand phishing-risk scanner. Click **Scan this page** and it checks the current page for common phishing signals — all computed locally, nothing leaves your device.

## What it checks (local heuristics)

- **HTTPS** — page not served over HTTPS
- **Raw IP address** as the host
- **Punycode / non-ASCII domains** (homoglyph lookalike risk)
- **Brand impersonation** — address contains a well-known brand name but isn't the official domain
- **Deep subdomain chains** and suspicious words in the hostname
- **Credential forms** posting over HTTP or to a different domain
- **Urgency / pressure language** ("verify immediately", "account suspended"...)
- **Link text vs destination mismatches**

## Risk barometer

Signals are weighted (high = 25, medium = 12, low = 5) into a 0–100 score with Low / Moderate / High / Critical bands.

> **Heuristic aid only — NOT a verdict.** These checks can miss real phishing and flag legitimate pages. When in doubt, close the tab and type the official address yourself.

## Permissions (minimal, justified)

- `activeTab` — scan only the tab you click on
- `scripting` — inject the scanner on demand (never automatically)
- `storage` — reserved for future scan history (currently unused)

## Privacy

100% local. No network requests, no accounts, no analytics, no tracking.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the toolbar icon, then **Scan this page**
