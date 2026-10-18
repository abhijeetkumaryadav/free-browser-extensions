# Churn Risk Worksheet

A manual churn-risk worksheet for keeping an eye on your customer list. You score each
customer by hand on four risk signals; the extension computes a weighted risk score,
ranks customers riskiest-first, and adds plain-language notes based on your scores.

## ⚠️ Honest scope

- **Manual only.** Nothing reads your CRM, emails, product analytics, or any customer data.
- **Your judgment scores** — every number is one you type.
- This is **not** automatic churn detection or a prediction tool. It is an organized
  worksheet that helps you act on the risk you already sense.

## Risk signals (each scored 1–5, higher = riskier)

| Signal | Weight | Meaning |
|---|---|---|
| Support tickets & escalations | 25% | 1 = quiet, 5 = constant escalations |
| Usage drop-off | 30% | 1 = steady usage, 5 = sharp drop |
| Renewal proximity | 25% | 1 = just renewed, 5 = renews soon |
| Low satisfaction (NPS) | 20% | 1 = promoters, 5 = detractors |

Risk score = weighted average (1.00–5.00).
**HIGH RISK** ≥ 4.00 · **WATCH** ≥ 2.75 · **HEALTHY** below that.

## Privacy

- All data stays in `chrome.storage.local` on your device.
- Zero network calls. No analytics, no tracking.

## Install (development)

1. Open `chrome://extensions` (or Edge `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select this folder.

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — the worksheet UI
- `icons/` — generated PNG icons
