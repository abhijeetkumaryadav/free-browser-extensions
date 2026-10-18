# CarbonShip — Freight CO₂e Calculator

Estimate the carbon footprint of a freight shipment from weight, distance, and
transport mode. **Clearly labeled estimates — not audited carbon accounting.**

## Install

- **Chrome / Edge / Opera:** unzip the folder, open `chrome://extensions`, enable
  **Developer mode**, click **Load unpacked**, select the folder.
- **Firefox:** MV3 `storage` is supported; should work as-is.

## How to use

1. Enter shipment weight (kg) and one-way distance (km).
2. Pick a transport mode (Air / Road / Rail / Sea), optionally tick **Round trip**.
3. Click **Calculate CO₂e** — you'll get kg CO₂e plus equivalents (km by petrol
   car, tree-years to absorb). Your last calculation is remembered locally.

## Emission factors (representative, g CO₂e per tonne-km)

| Mode | Factor | Basis |
|------|--------|-------|
| Air (long-haul) | ~500 | Representative of DEFRA/BEIS-style long-haul air-freight factors |
| Road (HGV, avg. laden) | ~62 | Representative articulated-HGV average-load factor |
| Rail (diesel freight) | ~22 | Representative diesel freight-rail average-load factor |
| Sea (container ship) | ~12 | Representative large container-vessel average-load factor |

Equivalents: petrol car ≈ 192 g CO₂e/km; one tree absorbs ≈ 21 kg CO₂/year.
All factors are order-of-magnitude estimates. Real emissions vary with vehicle
type, load factor, fuel, routing, and empty running.

## Permissions

- `storage` — remembers your last calculation. Nothing else.

## Scope

- 100% local: **zero network**, no APIs, no analytics, no credentials.
- Not a substitute for formal carbon accounting (e.g. GLEC Framework).

## Publishing notes

- Minimal permission set; no host permissions at all.
- No remote code, no external assets.
