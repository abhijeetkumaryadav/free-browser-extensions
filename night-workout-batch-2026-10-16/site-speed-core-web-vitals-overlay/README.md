# Site Speed: Core Web Vitals Overlay

Measure **real** Core Web Vitals on the current page — Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and Cumulative Layout Shift (CLS) — and show a graded on-page overlay.

## How it works

1. Click **Measure this page** in the popup.
2. A content script (injected on-demand only, via `chrome.scripting` + `activeTab`) uses the **PerformanceObserver API** with `buffered: true` to read the page's own performance entries from this visit, then keeps observing for ~6 more seconds.
3. It draws a dismissible **graded overlay** on the page (LCP / INP / CLS with GOOD / NEEDS WORK / POOR badges) and the popup shows:
   - Per-metric values with bars against official thresholds
   - The element responsible for the largest paint
   - The top layout-shift contributors with fix hints
4. **Remove overlay** clears the page layer.

The last measurement is saved locally and restored when you reopen the popup.

## Thresholds (web.dev)

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP | ≤ 2.5 s | ≤ 4.0 s | > 4.0 s |
| INP | ≤ 200 ms | ≤ 500 ms | > 500 ms |
| CLS | ≤ 0.10 | ≤ 0.25 | > 0.25 |

## Honest scope

- These are **real measured values from the current visit** — LCP from the last observed paint entry, INP approximated from the worst observed `event` timing entry, CLS as the sum of unexpected shifts — **not** estimates or simulations.
- Measurements are lab-style and device/network-dependent: values legitimately vary between visits, devices, and connections.
- If you haven't interacted with the page yet, INP may report “no input yet” — interact, then measure again.
- **Read-only analysis:** the only page change is the dismissible overlay. Nothing is transmitted — 100% local.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remember the last measurement |
| `activeTab` + `scripting` | Inject the measurement script only when you click “Measure” |

## Privacy

No accounts, no analytics, no network requests. All measurement happens in-page.
