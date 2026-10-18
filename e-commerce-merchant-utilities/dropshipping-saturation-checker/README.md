# Dropshipping Saturation Checker v1.0.0

**Scan page** on any product page: extracts title, brand, price, rating,
review/sold counters, image sources, and page copy — then computes an
explainable **0–100 saturation score** (higher = more over-sold) across six
weighted factors:

| Factor | Wt | What it detects |
|---|---|---|
| Source origin | 25 | Page hosted on a wholesale/mass-sourcing marketplace (AliExpress, Alibaba, Temu…) |
| Title genericness | 20 | Keyword-stuffed hype titles ("hot sale", "2024 new arrival", ALL CAPS) |
| Brand weakness | 15 | Missing, placeholder ("generic", "OEM"), or throwaway brand tokens |
| Image reuse | 15 | Supplier-CDN imagery (alicdn, temuimage…), low-effort photo sets |
| Social-proof inflation | 15 | Massive review/sold counters, high volume with mediocre ratings |
| Supplier boilerplate | 10 | Reseller-facing copy ("dropshipping welcome", "MOQ", "factory direct") |

Verdict bands: **FRESH** (0–33) · **WARMING UP** (34–55) ·
**HEATING UP** (56–75) · **SATURATED** (76–100), each with concrete next-step
tips. Save scans to history, compare products, and copy a text summary.

> Heuristic, on-device analysis — directional signal, not a guarantee of
> market conditions.

## Try it
1. Unzip `dropshipping-saturation-checker.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any product page → click the icon → **Scan page**.

## Permissions (all justified)
- `activeTab` + `scripting` — read the product page you explicitly scan. Nothing is read otherwise.
- `storage` — scan history saved on-device only.

**Network:** none. All detection and scoring runs locally in the popup;
no data leaves the device.

## Publishing notes
- Chrome Web Store: $5 one-time dev fee. Single-purpose, minimal permissions —
  no remote code, no traffic modification, nothing store-bannable.
- Firefox: loads as a temporary add-on; MV3 supported.

## Files
```
manifest.json, popup.html/css/js, icons/, README.md
```

## Future-proofing
- Manifest V3 only, no deprecated APIs.
- All page parsing isolated in one injectable, dependency-free function (`detectProduct`).
- All scoring weights, keyword lists, and verdict bands are named constants at the top of `popup.js` (`WEIGHTS`, `TITLE_BUZZWORDS`, `verdictFor`) — tune without touching UI code.
- Scoring is a pure function of the extracted signals (`scoreSaturation`), so it can be unit-tested outside the browser.
