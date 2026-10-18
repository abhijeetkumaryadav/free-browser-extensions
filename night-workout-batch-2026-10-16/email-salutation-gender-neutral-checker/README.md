# Neutral Salutations — Gender-Neutral Email Checker

Flags gendered email salutations (**Dear Sir**, **Hey guys**, …) using a bundled
pattern list and suggests gender-neutral alternatives. **100% local — no network
calls, no AI.**

## Honest scope

- **Heuristic only — not AI.** It matches text against 16 bundled salutation
  patterns. It cannot understand context (e.g. whether you know the recipient
  prefers "Mr."), so **review every flag yourself**.
- Two input modes:
  1. **Paste text** — paste your draft into the popup and check.
  2. **Scan active field** — click to read the focused text field (or current
     selection) on the active tab. Read-only; the page is never modified.
- Alternatives are one-click copyable.

## Features

- 16 bundled gendered-salutation patterns with plain-language notes and neutral
  alternatives (Dear [Name], Dear Team, Hey everyone, …).
- Match snippet shown with surrounding context.
- Reference section listing every bundled rule.
- Draft persists nowhere — nothing is stored except in-memory text you paste.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Reserved for future prefs; currently minimal use. |
| `activeTab` + `scripting` | Read the focused field only when you click "Grab field". |

## Files

- `manifest.json` — MV3 manifest.
- `popup.html` / `popup.css` / `popup.js` — popup UI and rule engine.
- `rules.js` — the bundled salutation list (16 rules).
- `content.js` — read-only field grabber (click-only injection).
- `icons/` — 16/48/128 PNG icons.

## Development notes

- Run `node --check` on every `.js` file before packaging.
- Load `chrome://extensions` → Developer mode → **Load unpacked** → select this folder.
- Not tested in a live browser beyond syntax/structure validation.
