# TokenTime — Gamified Screen Time Allowance

A kid-friendly **screen-time token economy** that runs 100% locally in the browser. Parents set a daily token allowance and per-site token costs; browsing configured sites spends tokens minute-by-minute; parents grant bonus tokens as rewards.

## How it works

- **Kid dashboard** (default tab): live token balance, a spend-down progress bar, today's per-site usage, and rewards earned.
- **Parent tab** (4-digit PIN, set on first use): daily allowance, site list with tokens-per-minute costs, reward grants with reasons, day reset, PIN change.
- **Background worker**: a 1-minute alarm checks the active tab; if its domain matches a configured site, tokens are deducted and usage logged. The toolbar badge always shows the remaining balance.
- **Day rollover**: at midnight the balance resets to the daily allowance.

## Honest scope

- Time is tracked **per minute on the active tab only**; Chrome may throttle alarms, so accounting is approximate.
- **Not a lock**: tokens are a family agreement. A tech-savvy kid can disable or bypass any extension — TokenTime works best paired with conversation.
- No accounts, no servers, no network calls. Everything lives in `chrome.storage.local`.

## Permissions

- `storage` — allowance, sites, balance, usage log.
- `alarms` — the 1-minute spend tick and day rollover.
- `tabs` — read the active tab's URL to match configured site domains. Page content is never read.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder (or install the `.zip` via the same dialog).
3. Open the popup, set a parent PIN, add sites, and set the daily allowance.
