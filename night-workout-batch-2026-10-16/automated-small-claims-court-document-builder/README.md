# Small Claims Doc Builder

A guided **template aid** that drafts a plain-language **demand letter** and **claim outline** from your inputs, plus a checklist of typical filing steps.

## What it does

- **Guided form** — parties, what happened, amount claimed, response deadline, and evidence list.
- **Demand letter** — a plain-language template letter, filled in from your inputs, with copy-to-clipboard.
- **Claim outline** — parties, amount, facts, basis, evidence list, damages breakdown, and what to ask the court — also copyable.
- **Filing checklist** — ten typical steps (confirm claim limits, deadlines, send the letter, file, serve, organize evidence, prepare a timeline, confirm the hearing) with local persistence.
- **Auto-save** — form inputs persist locally and documents update as you type.

## Honest scope — read first

- **This is NOT legal advice.** The documents are plain-language **templates** filled with your words.
- Steps, claim limits, fees, and deadlines **vary by jurisdiction**. Always verify with your local court's official forms and rules before filing or sending anything.
- No attorney–client relationship is created by using this tool.
- If the amount or complexity is significant, consult a licensed attorney in your area.

## Privacy

- 100% local. Form data and checklist state live in `chrome.storage.local` on this device.
- **Zero network calls**, no accounts, no analytics.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`storage` permission only) |
| `popup.html` / `popup.css` | 380px deep-dark glassmorphism UI, single amber accent |
| `popup.js` | Template builders, tabs, checklist, copy-to-clipboard |

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder (or install the `.zip` via your browser's extension installer).
3. Click the toolbar icon to open the builder.
