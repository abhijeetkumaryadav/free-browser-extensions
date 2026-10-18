# Patent Claim Analyzer v1.0.0

Paste patent claim text. The extension extracts numbered claims,
classifies them as independent vs dependent (by "claim N"
references), highlights key limiting terms, and generates an
editable claim-chart template (claim element → your notes) with
copy-to-clipboard and CSV export. Best-effort parsing, clearly
labeled — always verify against the original document. History of
past analyses kept on-device.

## Try it
1. Unzip `patent-claim-analyzer.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
   - Edge: `edge://extensions`, same steps.
   - Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
3. Paste claims (or use **Load sample**), hit **Analyze**.

## Permissions
- `storage` — saves your analysis history on-device. Nothing is uploaded anywhere.

## Publishing notes
- No host permissions, no remote code, no network calls.
- Chrome Web Store: $5 one-time developer registration fee.
