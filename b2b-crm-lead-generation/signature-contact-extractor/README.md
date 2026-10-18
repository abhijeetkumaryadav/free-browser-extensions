# Signature Contact Extractor v1.0.0

Scan the page you're viewing for email signatures and contact info:
email addresses, phone numbers, names near titles, job titles, and
LinkedIn/X links. Results are deduplicated into a contacts table with
per-field copy buttons, Copy-all-as-CSV, CSV export, and Clear.

## How it works
- Signature blocks: scans page regions for email-signature patterns
  (an email address plus nearby name-like and title-like lines).
- `mailto:` links and standalone phone numbers are picked up too.
- Detection is best-effort and heuristic — labels in the popup say so.

## Try it
1. Unzip `signature-contact-extractor.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode →
   **Load unpacked** → select the folder.
3. Open an email thread, contact page, or site footer → **Scan page**.

## Permissions
- `activeTab` + `scripting`: read the tab you choose to scan, only when
  you click Scan. Nothing is read in the background.
- `storage`: keep your collected contacts on this device only.

## Publishing notes
- No data leaves the device; no remote calls at all.
- Chrome Web Store: $5 one-time dev fee. Firefox/Edge ports: MV3
  compatible as-is (`chrome.*` APIs used are namespace-compatible).
