# CRM Dead Link Validator v1.0.0

Paste a list of URLs (one per line) and validate them in bulk. Each
URL opens in a **background tab** (never steals focus), the extension
waits for load, flags it as **alive / dead / unknown** from browser
error pages and error-like titles (can't be reached, ERR_*, 404…),
then closes the tab and moves on. Live progress bar, cancel anytime,
results table with CSV export. All on-device.

Best-effort: slow, login-walled, or bot-blocked pages may report as
unknown rather than alive.

## Try it
1. Unzip `crm-dead-link-validator.zip`.
2. `chrome://extensions` (Edge: `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
3. Paste URLs, hit **Validate links**.

## Permissions
- `tabs` — open each URL in a background tab and read its title/URL
  to detect browser error pages. Tabs are closed right after each check.
- `storage` — remember your last results between popup opens.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration.
- Single-purpose, minimal permissions, no data leaves the device.
