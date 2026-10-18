# Permission Audit Guard

A **read-only** audit of your installed extensions' declared permissions.
It lists every extension (except itself), scores risky permissions, flags
dangerous permission *combos* (e.g. `<all_urls>` + `scripting`), and explains
each flag in plain language — so you can decide what deserves to stay.

## Honest scope

- **Read-only.** This tool never disables, uninstalls, or changes anything.
  It only reads the permission lists Chrome already shows you.
- **Heuristic scores, not verdicts.** A "Critical" score means *review
  carefully*, not *malicious*. Legitimate extensions (password managers,
  ad blockers) often need broad permissions.
- **100% local.** The report is generated in the popup and optionally
  exported by you as JSON. Nothing is uploaded.

## Permissions (justified)

| Permission | Why |
|---|---|
| `management` | Required to list installed extensions and read their declared permissions — the entire point of the tool. |
| `storage` | Cache the last report so reopening the popup is instant. |

## Install (developer mode)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked**
2. Select this folder. Click the toolbar icon to run the audit.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — audit UI + risk engine
- `icons/` — generated PNG icons (16/48/128)
