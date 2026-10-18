# UV Burn Timer — Ozone & UV Safety Edu

A Chrome/Edge/Firefox/Opera MV3 extension that explains the ozone layer and the
UV index, then estimates how long unprotected skin can stay in the sun before
burning — from the UV index **you** enter and your Fitzpatrick skin type.

## Honest scope

- **Estimates — not medical advice.** The burn-time math is a simple published
  heuristic (`200 / UVI × skin factor`), not a diagnosis or recommendation.
- **No live UV data.** The extension fetches nothing; it only computes from the
  UV index you type in (check your local weather forecast).
- Zero network, `storage` permission only.

## Features

- Burn-time estimator: UV index + Fitzpatrick type I–VI → estimated unprotected
  burn time, plus the theoretical SPF-30-stretched time.
- UV index scale guide (Low → Extreme) with color bands.
- Ozone-layer explainer: why thinner ozone means more UV-B at the surface.
- Sunscreen notes: SPF reality, reapply timing, shade-first guidance.

## Install

1. Open `chrome://extensions` (or your browser's equivalent).
2. Enable Developer mode.
3. "Load unpacked" → select this folder.

## Privacy

Everything stays in your browser. No accounts, no network, no tracking.
