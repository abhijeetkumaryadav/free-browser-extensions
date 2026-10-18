# Ad Spend ROI Forecaster

An educational ad-spend calculator. Enter your assumptions, get instant math.

**Honest scope — read first:**
- This is a **math model, not a prediction**. Results depend entirely on the assumptions you type.
- Real auctions, seasonality, creative quality, audience saturation, and platform fees will differ.
- Not financial or marketing advice.

## How it works

- **CPC model:** clicks = spend ÷ CPC · **CPM model:** impressions = spend ÷ CPM × 1000, clicks = impressions × CTR.
- Conversions = clicks × conversion rate · Revenue = conversions × AOV.
- Gross profit = revenue × margin · Net profit = gross − spend.
- ROAS = revenue ÷ spend.
- **Break-even CPC** = conversion rate × AOV × margin — the highest CPC you can pay and still profit (CPC model).
- The **what-if slider** varies conversion rate live so you can see sensitivity.

## Privacy

- 100% local. No network requests, no analytics.
- `storage` remembers your inputs between sessions.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI
- `roi.js` — dependency-free ROI math (unit-tested in Node)

## Permissions

- `storage` — persist inputs
