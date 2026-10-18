# RFP Requirement Matrixer v1.0.0

Paste RFP text and get a compliance matrix: best-effort extraction
of numbered / lettered / bulleted requirements (1., a., •, R-1…),
each with a compliance dropdown (yes / partial / no / not decided)
and a notes field. Progress bar + yes/partial/no stats, one-click
CSV export, and the in-progress matrix is restored between popup
opens. Extraction is best-effort and clearly labeled — always
review and edit the list.

## Try it
1. Unzip `rfp-requirement-matrixer.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Click the icon, paste RFP text, build the matrix.

Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
Edge: same as Chrome via `edge://extensions`.

## Publishing notes
- Permissions: `storage` only (matrix saved on-device). Nothing uploaded.
- Chrome Web Store: $5 one-time developer registration.
