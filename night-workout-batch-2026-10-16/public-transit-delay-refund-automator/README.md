# Public Transit Delay Refund Helper

**Version 1.0.0** — A manual refund-claim helper browser extension (Manifest V3).

## What it does

- **Log delay**: record transit delays (agency, route, date, delay minutes, stations, ticket reference) with a stats dashboard (delays logged, minutes delayed, claims tracked).
- **Claim letter**: generates a plain-language refund-request letter from a logged delay; copy to clipboard or open in your email client (mailto draft — you send it yourself).
- **Checklist**: six-step claim workflow (record, keep proof, check policy, generate letter, submit, follow up) with persistent done-state.
- **Status tracking**: mark each delay as logged / claim sent / refunded / denied.

## Honest scope (read this)

- **Manual helper only.** No transit agency offers an API for extensions to file refunds, so this extension cannot submit anything automatically. It prepares your claim; you submit it yourself.
- Refund thresholds, policies, and response times vary by agency — always verify on the agency's official website.
- **100% local.** Permissions: `storage` only. All data stays in this browser. No network requests, no accounts.

## Privacy

- Permissions: `storage` only.
- No data leaves the device. Deleting the extension deletes your logs.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest |
| `popup.html` / `popup.css` | 380px deep-dark glassmorphism popup, 3 tabs |
| `popup.js` | Logbook, letter generator, checklist logic |
| `icons/` | Generated 16/48/128 PNG icons |
| `README.md` | This file |

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked**, select this folder.
3. Log a delay, generate the letter, submit it to your agency yourself.
