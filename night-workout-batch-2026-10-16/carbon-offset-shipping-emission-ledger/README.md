# Carbon Offset Shipping Emission Ledger

Log shipments, estimate their CO₂e footprint, and keep a ledger of carbon
offsets — all locally in your browser.

## Features

- **Shipment logging** — mode (air / sea / road / rail), distance, weight, note.
- **CO₂e estimates** — computed from standard published emission factors per
  tonne-km (clearly labeled estimates, not measured values).
- **Dashboard** — total emitted, total offset, net balance.
- **Per-mode breakdown** — bar chart of emissions by transport mode.
- **Offset ledger** — record purchased offsets against your footprint.
- **Full ledger** with per-entry delete.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.

## Permissions

- `storage` — persists your ledger locally.

## Honest scope

- Emission factors are representative published figures; real values vary by
  route, carrier, load factor and fuel. All results are **estimates**.
- The extension does not buy or verify offsets — you record them manually.
- 100% local: no network calls, no accounts, no telemetry.
