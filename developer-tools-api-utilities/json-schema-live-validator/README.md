# JSON Schema Live Validator v1.0.0

Paste a JSON document and a JSON Schema (draft-07 subset) and get
instant, on-device validation with errors listed by JSON path
(`$.address.zip`). Re-validates live as you type (debounced).
Supports: type, required, properties, additionalProperties, items
(including tuples), enum, const, string length/pattern, number
min/max/exclusive bounds/multipleOf, array min/max/uniqueItems,
object min/maxProperties. Includes a Load sample button; your last
inputs are remembered locally.

## Try it
1. Unzip `json-schema-live-validator.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon → **Load sample** → break the JSON and watch errors appear.

## Publishing notes
- Permissions: `storage` only (remembers your last document/schema).
  No page access, no network, nothing uploaded — validation is pure
  on-device JavaScript.
- Chrome Web Store: $5 one-time dev fee. Edge/Firefox: free accounts.
