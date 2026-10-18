# Aerial Photogrammetry Overlap Flight Planner

Survey math in the popup: enter altitude AGL, focal length, sensor size, and
image width — get ground sample distance (GSD), ground footprint, photo
spacing from your front/side overlap percentages, and a line/photo count
estimate for a rectangular area.

**Scope (honest): estimates — verify against your mission software.**
Idealized flat-terrain math: similar triangles for footprint
(`ground = altitude × sensor / focal`), pixel size for GSD, and
`spacing = footprint × (1 − overlap)`. Ignores terrain relief, wind drift,
camera distortion, and turn-around overshoot.

- Manifest V3, fully local (zero network). Permissions: `storage` only
  (remembers your last inputs).
- UI: 380px deep-dark glassmorphism, one cyan accent (`#22d3ee`),
  Lucide-style outline icons.
