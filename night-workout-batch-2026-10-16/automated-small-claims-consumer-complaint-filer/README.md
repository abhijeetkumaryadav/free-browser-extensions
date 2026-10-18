# Complaint Helper — Consumer Complaint Filer

A guided, **manual** consumer-complaint assistant. No extension can file a complaint for you — this builds the **letter and checklist**, and **you file it yourself**.

## What it does

Three tabs:

1. **Your details** — your name and contact, the company, what happened (in your own words), amount, dates, what you're asking for, evidence list, filing venue, and the response deadline you set. Auto-saved locally.
2. **Letter** — generates a plain-language formal complaint letter from your inputs, live. Copy-to-clipboard button.
3. **Checklist** — 10 typical filing steps (facts, evidence, company process first, send letter, choose venue, attach copies, track reference number, watch the deadline, escalate, keep documents) with persistent done-state, plus a filing-status tracker (draft → letter ready → filed → awaiting → resolved / escalated).

## Honest scope (labeled in the popup)

- **Templates only — NOT legal advice.** Rules, limits, fees, and deadlines vary by jurisdiction; verify with your local consumer authority or court.
- The extension **does not file anything** — there is no API for that. You send the letter and submit the complaint yourself.
- All data stays in `chrome.storage.local`. Zero network.

## Permissions

- `storage` — save your details, checklist progress, and status.

## Files

- `manifest.json` — MV3 manifest.
- `popup.html` / `popup.css` / `popup.js` — three-tab UI, letter builder, checklist.
- `icons/` — generated PNG icons.

## Development

Validation: `node --check` on `popup.js`, `manifest.json` JSON parse, icon sizes, ZIP root check.
