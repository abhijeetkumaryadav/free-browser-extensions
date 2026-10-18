# HTML Validation Badge v1.0.0

On-device HTML health check for the current page. Hit **Validate**
and get a score ring plus issues grouped by severity:

- **Errors** — images missing `alt`, duplicate `id`s
- **Warnings** — missing `lang`, empty `<title>`, empty links/buttons,
  possible tag mismatches (best-effort)
- **Notices** — missing viewport meta, missing meta description

Score starts at 100 and deducts per issue. Recent validations are
kept in a short on-device history. Best-effort checks against the
serialized DOM — not a substitute for the W3C validator.

## Try it
1. Unzip `html-validation-badge.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any page, click the icon, hit **Validate**.

## Permissions
- `activeTab` + `scripting` — serialize the current tab's DOM when you
  press Validate. Nothing is read otherwise.
- `storage` — recent validation history, on-device only.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee.
