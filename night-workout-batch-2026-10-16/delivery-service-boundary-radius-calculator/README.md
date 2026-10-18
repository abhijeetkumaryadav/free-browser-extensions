# Delivery Zone Calculator — Radius Boundaries

**Your zones — local math.** Save delivery zones (name, center latitude/longitude,
radius in km), then:

- **Point check** — enter a customer's coordinates and see which zones contain it,
  with distance from each center.
- **Distance** — haversine distance between any two points.
- **Notes** — your private delivery notes, autosaved locally.

Distances use the haversine great-circle formula on the coordinates you enter.
There are no maps, no live services, no network calls (`storage` permission
only). Core math lives in `popup.js` between `// ENGINE-START` and
`// ENGINE-END` and is headless-tested.
