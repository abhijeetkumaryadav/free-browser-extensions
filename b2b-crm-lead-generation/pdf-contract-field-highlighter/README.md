# Contract Field Highlighter v1.0.0

Contract review helper: paste contract text and it scans for key
clause families — **termination, liability cap, payment terms,
renewal/auto-renew, confidentiality, governing law** — showing each
hit with its surrounding context (matched terms highlighted) and a
per-clause **review checklist** with a progress bar. Text and checklist
persist on-device between sessions.

Clearly labeled as **text-pattern based**: it spots likely clause
locations with regex heuristics. It is not legal advice — always have
counsel review.

## Try it
1. Unzip `pdf-contract-field-highlighter.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Click the icon, paste contract text, hit **Scan clauses**, tick off clauses as you review them.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.
Edge: `edge://extensions` → Developer mode → Load unpacked.

## Permissions
- `storage` — saves the pasted text and checklist on-device. Nothing else.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration; declare `storage` in the privacy section.
- Firefox Add-ons: free account; automated signing (no remote code — clean).
- No network calls, no analytics, no external services. No PDF parsing library — works on pasted text by design.
