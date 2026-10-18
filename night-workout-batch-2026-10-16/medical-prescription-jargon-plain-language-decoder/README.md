# Rx Decoder — Plain-Language Prescription Jargon

Educational reference that decodes common prescription abbreviations
(`qd`, `bid`, `tid`, `prn`, `ac`, `pc`, …) into plain language.

## Features

- **Search the dictionary** — ~60 common prescription/pharmacy abbreviations
  (frequency, timing vs meals, route, quantity, instructions) with plain-language
  meanings and Latin-origin notes.
- **Decode a label line** — paste something like `Take 1 tab po bid ac` and it
  highlights each known abbreviation with its meaning.

## Safety disclaimer (prominent in the popup)

> **EDUCATIONAL ONLY — not medical advice.** Abbreviations vary by region and
> prescriber. If anything is unclear or seems wrong, ask your pharmacist or
> doctor — never guess a dose.

## Permissions

- `storage` — reserved for future favorites; currently the extension is fully
  stateless.

## Notes

- Bundled static dictionary (`data.js`); no network, no AI, no accounts.
- Matching is case-insensitive and whole-word; unknown tokens are left alone.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `data.js`, `README.md`,
`icons/`.
