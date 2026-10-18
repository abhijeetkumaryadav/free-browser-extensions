# PhishGuard — Anti-Phishing Domain Checker

Analyzes the current tab's URL with **local heuristics only** and shows a
0–100 risk score with a per-signal breakdown. Nothing is ever sent anywhere
by the extension — no analytics, no lookups, no network calls at all.

## Signals checked (all on-device)

- Non-HTTPS page
- IP-literal host instead of a domain name
- Punycode / non-ASCII lookalike characters
- Excessive subdomain stacking
- Brand name inside a non-brand domain (e.g. "paypal" on a lookalike domain)
- High-risk TLD (`.tk`, `.xyz`, `.top`, …)
- Unusually long URL (>100 chars)
- `@` credential-style trick in the URL
- Hyphen-stuffed domain

Heuristics are hints, not proof. The popup says so explicitly.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
enable **Developer mode** → **Load unpacked** → select the folder.

**Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on →
select `manifest.json`. (Temporary installs only unless signed.)

**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab's URL when you open the popup, so it can be analyzed. Nothing else. |

The **Check on VirusTotal** button opens virustotal.com for the domain —
it only fires when you click it. The extension itself never transmits your URL.

## Publishing notes

- Manifest V3, no remote code, no data collection → straightforward
  Chrome Web Store / Edge Add-ons review.
- Privacy practice disclosure: "Does not collect or transmit any user data."
