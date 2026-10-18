# Client Onboarding Form Macro Automator

Form autofill helper for client onboarding workflows.

## What it does
- **Client profiles** — keep separate field-mapping sets per client.
- **Field mappings** — define "label pattern → answer" pairs (e.g. label
  contains `first name` → `Aarav`).
- **Scan this form** — counts fillable fields and shows how many match your
  mappings and how many are blocked.
- **Fill this form** — fills matching fields on explicit click only.

## Honest scope (read me)
- Fills **only when you click Fill**. Nothing is automatic.
- **Password and payment fields are always blocked**: passwords, PINs,
  card numbers, CVV, expiry, SSN — matched or not, they are never touched.
- Checkbox, radio, file, submit, hidden and disabled fields are skipped.
- The extension **never submits the form**. Always review before submitting.

## Permissions
`storage` (profiles + mappings), `activeTab` + `scripting` (scan/fill on the
tab you explicitly click on). No host permissions, no network calls, 100% local.

## Install
1. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode.
2. "Load unpacked" → select this folder. Or load the `.zip` via "Load unpacked"
   after extracting.
