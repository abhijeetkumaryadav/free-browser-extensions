# Sonic Boom Overpressure Estimator

Educational estimator of a supersonic aircraft's ground sonic-boom signature using the
**Carlson (1978) simplified sonic-boom theory** scaling:

- Bow-shock overpressure: Δp ∝ √(p_v·p_g)·(M²−1)^(1/8)·(h/l)^(−3/4), with a lumped
  constant calibrated so Concorde (Mach 2, 50,000 ft, 203 ft) yields ≈ 2 psf
- N-wave duration via Carlson's duration scaling
- Boom-carpet half-width via the cutoff-Mach ray model (typical cutoff Mach ≈ 1.15)
- Mach cone half-angle μ = arcsin(1/M)

## Inputs
- **Mach number** (> 1)
- **Altitude** in feet MSL
- **Aircraft length** in feet

## Outputs
- Peak overpressure (psf and Pa), N-wave duration (s), boom-carpet half-width (mi),
  Mach cone half-angle, and a plain-language loudness verdict.

## Honest scope
**Simplified model — educational only.** Real booms depend on atmospheric profiles,
maneuvers, focusing, and aircraft shaping. This is an estimate, not a prediction.
No network. Inputs are remembered locally.
