# Formula Macro Converter v1.0.0

Paste an **Excel formula** and get best-effort conversions to
**Google Sheets**, **JavaScript**, and **Python** via an on-device
function-mapping table (~65 common functions: math, text, date,
lookup, financial). Each output has a copy button; a function-notes
panel shows per-function equivalents and flags anything with no
mapping (e.g. VLOOKUP in JS/Python) for manual review.

Best-effort and honest: cell references are kept as-is, `IF`
becomes a ternary note in JS, and financial functions point at
`numpy-financial` in Python.

## Try it
1. Unzip `formula-macro-converter.zip`.
2. `chrome://extensions` (Edge: `edge://extensions`, Firefox: `about:debugging`) → Developer mode → **Load unpacked** → select the folder.
3. Click the icon, paste a formula, hit **Convert** (or Ctrl/Cmd+Enter).

## Permissions
- None. Pure popup tool; nothing is read, stored, or uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration. No data collected — say so in the privacy tab.
- Firefox: same source works; submit via addons.mozilla.org for signing.
