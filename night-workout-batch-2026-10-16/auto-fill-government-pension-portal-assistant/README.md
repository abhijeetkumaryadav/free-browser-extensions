# FormFill Buddy — Senior Form Assistant

A gentle helper for long, confusing web forms (government portals, pension applications, registrations). Save your own details once, then fill matching fields on any page — **only when you click the button**.

## What it does

- **My details tab** — save name, email, phone, address, city, state, postal code, country, date of birth. Stored only in `chrome.storage.local` on your device.
- **Fill button** — injects a matcher on the active tab that maps profile fields to form fields using name/id/label heuristics (including framework-friendly value setting so React-style forms notice the change).
- **Never auto-fills.** There is no automatic filling on page load, no background watching. Every fill requires your explicit click.
- **Never touches** password, hidden, file, checkbox, radio, submit, or disabled/read-only fields.
- Filled fields get a brief green outline so you can see what changed.

## Honest scope

- Matching is heuristic: unusual field naming may be missed or mismatched. **Always verify every field before submitting** — the popup says this prominently and the filled fields flash so you can review them.
- This is a convenience tool, not a form-validation or security tool. It does not check what a form will send.
- 100% local. Zero network requests. Nothing you type or save ever leaves your device.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your profile on this device |
| `activeTab` | Access the tab you clicked the button on |
| `scripting` | Inject the field-matching script only after your click |

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open the popup, go to **My details**, save your details, then click **Fill form fields on this page** on any form.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and profile logic
- `content.js` — click-triggered field matcher (never runs uninvited)
- `icons/` — generated 16/48/128 PNG icons
