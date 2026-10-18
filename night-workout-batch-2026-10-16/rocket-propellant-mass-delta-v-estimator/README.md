# Delta-V Estimator

Tsiolkovsky rocket-equation calculator. Single stage and multi-stage.

## What it does

- **Single stage:** enter dry mass (kg), propellant mass (kg), Isp (s), g₀ (m/s²) →
  Δv = Isp · g₀ · ln((dry + prop) / dry), plus mass ratio and exhaust velocity
- **Multi-stage:** up to 6 stages; each stage's Δv is computed against the current
  stack mass (upper stages ride as payload), and stages are dropped after burn

## Honest scope

**Textbook physics — estimates.** Ideal rocket equation: no drag, no gravity
losses, instant burns. Educational only; not engineering advice.

## Permissions

- `storage` — nothing stored yet (reserved); inputs stay in the popup session.

## Privacy

Zero network. Nothing leaves the browser.
