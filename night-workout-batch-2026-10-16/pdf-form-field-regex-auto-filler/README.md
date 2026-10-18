# Form Fill Helper — Regex Rules for HTML Forms

Save regex rules (field-name pattern → value). User-triggered on the current tab: scan fields, preview matches, then fill. Clear restores inputs.

## Honest scope

- **HTML forms only.** This extension does not parse PDF files and does not fill PDF forms.
- Every action is user-triggered on the tab you click from. Nothing is automatic or global.
- Preview shows exactly which rule matches each field before you fill. Always review the page before submitting anything.
- “Clear filled” empties the tab's inputs to undo a fill.
- Fully local: rules live in `chrome.storage.local`. No network calls, ever.

## Rules

- Pattern is a JavaScript regex tested against each field's name, id, placeholder, aria-label, and type. First matching rule wins.
- Case-insensitive by default; uncheck for case-sensitive.
- Values up to 5000 chars; 200 rules max. Export/import JSON for backup.

## Files

- `manifest.json` — MV3, permissions: `activeTab`, `scripting`, `storage`
- `popup.html` / `popup.css` / `popup.js` — UI + engine
- `icons/` — generated PNG icons (16/48/128)

## Testing

Run `node --check popup.js` for syntax. Headless engine tests cover `makeRule` (valid/invalid/oversize), `compileRules` (skips broken), `fieldKey`, and `previewMatches` (first-match-wins, no-match).
