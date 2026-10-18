# Loan Repay Planner

A Chrome/Edge/Firefox/Opera (MV3) browser extension that helps you understand a
fixed-rate loan's repayment math.

## What it does

- Enter **balance, APR, term, and optional extra monthly payment**
- Computes the standard **monthly payment**
- Builds a **yearly amortization schedule** (principal vs. interest per year)
- Shows **total interest**, **estimated payoff date**, and a principal/interest bar
- Compares an **extra-payment scenario**: how much interest you could save and
  how many months earlier the loan would be paid off

## Honest scope

- **Educational estimates only — NOT financial advice.** All math assumes a
  fixed APR and on-time monthly payments. Real loans may include fees,
  variable rates, grace periods, or compounding differences. Confirm terms with
  your lender or a licensed advisor.
- 100% local: inputs are stored in your browser (`chrome.storage.local`) for
  convenience, nothing is sent anywhere.

## Permissions

- `storage` — remembers your last-entered loan inputs.

## Privacy

No network requests. No analytics. No data leaves the browser.
