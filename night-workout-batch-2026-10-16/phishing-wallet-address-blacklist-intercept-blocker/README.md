# Scam Wallet Checker (`phishing-wallet-address-blacklist-intercept-blocker`)

A **defensive, check-only** tool. Paste a crypto wallet address and check it against a
local, user-editable list of known scam addresses.

## What it does

- Paste an address (ETH/BTC/SOL shapes recognized heuristically) → instant local lookup.
- Warns with plain-language explanations on a match; otherwise explains that a
  non-match is **not** a safety guarantee.
- Manage your own list: add/remove entries; bundled sample entries are clearly marked.

## What it does NOT do

- Never intercepts, blocks, or modifies anything — no content script, no page changes.
- Cannot know every scam address. Scammers rotate addresses constantly.
- The shape check (ETH/BTC/SOL patterns) is loose and is not a real validator.

## Honest scope

Check-only reference aid. A "clean" result only means "not on your list" — always
verify recipients through independent channels before sending funds.

## Privacy

100% local. `storage` permission only. No network calls, no remote code.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `data.js` (sample seed list),
`README.md`, `icons/`.
