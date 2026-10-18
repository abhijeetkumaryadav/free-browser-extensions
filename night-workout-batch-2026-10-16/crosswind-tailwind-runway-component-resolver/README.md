# Crosswind Component Resolver

Resolve wind into **headwind/tailwind** and **crosswind** components for a given runway heading, with a canvas wind diagram showing where the wind comes from.

## What it does

- Enter **runway heading** (°), **wind direction** (°, where the wind comes FROM) and **wind speed** (kt)
- Computes headwind vs tailwind and crosswind strength, with **left/right** indication
- Draws a runway + wind-arrow diagram relative to the runway
- Remembers your last inputs locally

## Honest scope

Calculation aid — **not flight planning**. It does plain trigonometry on the numbers you enter. Always verify against official weather briefings and your aircraft's limitations before flying.

## Privacy

Fully local. Zero network. Nothing leaves the browser.
