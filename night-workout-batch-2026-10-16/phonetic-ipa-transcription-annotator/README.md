# IPA Annotator — Your Pairs, Ruby Readings

Adds IPA readings to page text using **pairs you supply yourself**:
add `word → IPA` pairs (e.g. `through → θruː`), then click
**Annotate this tab** — every whole-word match is wrapped in a `<ruby>` tag with
your IPA above it. **Remove** unwraps everything, restoring the page exactly.

Matching is longest-word-first and case-insensitive; script/style/form/résumé and
editable regions are never touched. Internal pages (`chrome://` etc.) are off-limits.

**Honest scope:** annotates **only your pairs** — it cannot parse phonetics,
guess readings, or transcribe anything automatically.

## Details
- MV3, 380px deep-dark glassmorphism, one rose accent (#fb7185)
- Permissions: `storage` + `activeTab` + `scripting` (click-only injection)
- Fully local, zero network

## Files
- `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js` (pair engine between `// ENGINE-START` / `// ENGINE-END`), `README.md`, `icons/icon{16,48,128}.png`
