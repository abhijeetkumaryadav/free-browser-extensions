# Fake Review Flagger

Scans the current product page for fake-review signals and scores review
trustworthiness from 0–100: **Likely trustworthy**, **Some red flags**, or
**Looks suspicious**.

## What it checks (all on-device)

1. **5-star skew** — a histogram or sample where ≥80% of ratings are 5★
2. **Incentivized language** — phrases like “in exchange for”, “free product”, “honest review”
3. **Review-velocity spikes** — ≥40% of dated reviews landing on a single day
4. **Unverified purchase ratio** — less than half of sampled reviews marked verified
5. **Duplicate titles** — the same review title appearing 3+ times (templated fakes)
6. **Unusually short reviews** — average body under ~120 characters
7. **Generic reviewer names** — placeholder-style names like “Amazon Customer”

Each flag deducts from a 100-point trust score. A scan history of your last
5 checks is kept locally in the popup.

## Install

### Chrome / Edge
1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this folder
4. Pin the extension, open any product page, click the icon → **Scan page**

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`
3. Open any product page, click the toolbar icon → **Scan page**

Note: Firefox requires `scripting` API support — available in Firefox 121+.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `activeTab` | Read the currently open product page only when you click **Scan page** |
| `scripting` | Inject the review scanner into the active tab on demand |
| `storage` | Save your last 5 scan results locally for the history list |

No network requests are made. All analysis runs on-device; nothing leaves
your browser. No remote code, no tracking, no data collection.

## Publishing notes

- MV3-only, no deprecated APIs.
- Icons: 16/48/128px gradient shield with exclamation mark.
- Store listing category: Shopping / Utilities.
- Privacy: “This extension does not collect any user data.”
- Works on any site with DOM-exposed reviews (Amazon, Flipkart, Walmart, etc.);
  heuristics are generic, not site-specific.
