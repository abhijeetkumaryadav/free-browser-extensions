# TripAdvisor Review Anomaly Detector v1.0.0

Manually log your business's average rating over time. Z-score statistics flag
sudden drops and spikes on an annotated timeline chart. **100% offline — this
extension never scrapes TripAdvisor or any review site.**

## Features

- **Manual rating log** — you enter snapshots yourself: date, average rating
  (1–5), review count, and an optional note (e.g. "menu change rolled out").
- **Z-score anomaly detection** — each new snapshot is compared against its
  *prior* history: `z = (rating − mean of prior ratings) ÷ std-dev of prior
  ratings`. Snapshots with |z| ≥ 2 are flagged as sudden **drops** (▼) or
  **spikes** (▲). Needs 3+ prior snapshots to compute statistics.
- **Annotated timeline chart** — plain-canvas line chart of your ratings with
  red rings on anomalous points and date labels.
- **Anomaly list** — every flag with its date, rating, and z-score.
- **CSV export** — one click downloads the full log with z-scores and flags.

## Honest scope

- This is a **manual log + statistics** tool, not a scraper. Ratings are typed
  in by you. There is deliberately no access to TripAdvisor, no page reading,
  and no network traffic of any kind.
- Flags are purely statistical and can have false positives (e.g. a genuine
  improvement after renovations will flag as a spike — that's the point).

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist your rating snapshots on-device. Nothing else. |

No host permissions, no content scripts, no network access.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`.
**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Publishing notes

- MV3 only, no deprecated APIs.
- Minimal single permission (`storage`) with a clear justification — store-safe.
- No remote code, no data collection — privacy disclosure is trivially "no data collected".
