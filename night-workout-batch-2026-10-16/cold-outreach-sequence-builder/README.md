# Cold Outreach Sequence Builder

Build multi-step cold outreach sequences (emails/messages) as templates with `{{variable}}` placeholders, preview filled versions per recipient, and copy each step to paste wherever you send from.

## Honest scope

- **Templates + copy only.** This extension does NOT send emails or messages. You copy the rendered text and send it yourself from your own tools.
- No network requests, ever. Everything stays in `chrome.storage.local`.
- Outreach reminder: respect anti-spam laws (CAN-SPAM, GDPR) and only contact people with a legitimate reason.

## Features

- **Sequences**: multiple named sequences (e.g. "SaaS founders", "Design agencies").
- **Steps**: each step has a name, send-on day offset (Day 0 → Day 3 → Day 10 = follow-up spacing), optional subject, and body with variables.
- **Variables**: `{{name}}` `{{company}}` `{{email}}` `{{role}}` `{{title}}` — unknown placeholders are left untouched.
- **Steps tab**: timeline view with reorder (↑/↓), edit, delete.
- **Preview tab**: fill variables, live-render every step, copy one step or all steps.

## How to use

1. Create a sequence, add steps with day offsets.
2. Go to Preview, fill the recipient's variables.
3. Copy each step and paste into your email tool.

## Files

- `manifest.json` — MV3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js`
- `icons/` — 16/48/128 PNGs (generated)

## Compatibility

Chrome / Edge / Opera (Manifest V3). Firefox-compatible with `browser` polyfill adjustments.
