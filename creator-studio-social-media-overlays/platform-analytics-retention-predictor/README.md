# Retention Curve Predictor — v1.0.0

Paste audience-retention data points (time → % viewers) and get a heuristic
exponential decay-curve fit, automatic drop-off detection, and hook/chapter
placement suggestions.

> **Honest scope:** this is a heuristic estimator for planning. It reads no
> analytics account, calls no API, and its output is **not** real platform data.

## Features
- Flexible input: `0:30 82%`, `30,82`, `1:00 — 74%` — one point per line
- Exponential decay fit (R(t) ≈ a·e^(−bt)) with R² shown
- Canvas chart: your data, the fitted curve, and red drop-off markers
- Biggest drop-offs ranked with severity badges
- Concrete suggestions: front-load payoff, pattern interrupts, chapter markers
- Sample dataset included to try it instantly

## Install
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** and select the folder.
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`.

## Permissions
**None.** The extension requests zero permissions. All math runs locally in the
popup; nothing is stored or transmitted.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration, MV3, privacy tab can
  state "no data collected".
- Edge Add-ons: free account, same package works.
- Firefox: free account, requires AMO signing; pure DOM/canvas code is fully
  cross-browser.

## Method notes (for the curious)
- Fit: least-squares on log(retention) vs time.
- Drop-offs: 3-point moving-average smoothing, then steepest local declines,
  de-duplicated to distinct moments.
