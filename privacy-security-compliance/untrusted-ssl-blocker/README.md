# Untrusted SSL Blocker v1.0.0

Connection-safety guard for plain-HTTP pages.

## What it does
- Shows a **protocol badge** for the current tab (HTTPS / HTTP / N/A) with a plain-language verdict.
- On **plain-HTTP pages**, shows a warning banner with a one-click **"Try HTTPS version"** button.
- Scans the page for **password and payment forms**; on HTTP pages these are flagged **HIGH RISK** (anything typed can be read in transit), on HTTPS they're shown as informational.
- **HTTPS-only domains**: your personal list of domains that should never load over HTTP — you get an explicit warning if one does. Add the current site with one click, remove anytime.

## Honest limitation
Browser extensions **cannot read TLS certificate details** (issuer, expiry, chain) via the WebExtensions API, so this tool does not claim to validate certificates. It guards the transport layer it *can* see: the URL scheme, plus where your keystrokes go.

## Install (load unpacked)
1. Unzip `untrusted-ssl-blocker.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`, Firefox: `about:debugging#/runtime/this-firefox`).
3. Enable **Developer mode**, click **Load unpacked**, select the unzipped folder.

## Permissions (minimal, justified)
- `activeTab` — read the current tab's URL to determine its protocol.
- `scripting` — inject the form scanner into the current page on demand (only when you open the popup).
- `storage` — save your HTTPS-only domain list on-device.

Nothing is sent anywhere. All analysis happens on-device.

## Publishing notes
- Manifest V3, no remote code, no data collection — suitable for Chrome Web Store / Edge Add-ons / Firefox AMO review.
- Provide a privacy policy stating no data is collected.
