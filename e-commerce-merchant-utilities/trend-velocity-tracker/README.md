# Trend Velocity Tracker v1.0.0

Log snapshots of a product (price, rating, review count, rank) —
auto-filled by scanning the page, or entered manually — then watch
each metric's **velocity** (change per week) with sparkline charts
and trend badges: **Accelerating**, **Steady**, or **Cooling**.
All data stays on-device.

## Try it
1. Unzip `trend-velocity-tracker.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open a product page → **Scan page** → **Log snapshot** → repeat over days to see velocity.

## Publishing notes
- Permissions: `activeTab` + `scripting` (scan the product page you click
  on), `storage` (snapshots on-device). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee. Edge Add-ons free; Firefox signing required.
