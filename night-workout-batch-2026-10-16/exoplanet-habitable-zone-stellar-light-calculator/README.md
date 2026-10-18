# Habitable Zone Calculator

Estimate a star's habitable-zone distance bounds from its luminosity and
effective temperature, using a simplified model in the spirit of Kopparapu
et al. (2013).

## What it does

- Enter **luminosity (L☉)** and **effective temperature (K)**.
- Computes the **conservative** HZ (Runaway Greenhouse → Maximum Greenhouse)
  and the **optimistic** HZ (Recent Venus → Early Mars) inner/outer boundaries
  in astronomical units (AU), with a visual band chart and a rough spectral
  class estimate.
- Remembers your last inputs locally (`chrome.storage.local`).

## The model

For each boundary, the effective stellar flux is

`S_eff = S☉ + a·T + b·T² + c·T³ + d·T⁴`  with `T = T_eff − 5780 K`,

and the boundary distance is `d = √((L/L☉) / S_eff)`.

## Honest scope

**Simplified model — educational only.** This is a heuristic implementation
of a simplified flux-polynomial model. It ignores stellar evolution,
planetary albedo, atmospheric composition, eccentricity, and everything else
real habitability analysis needs. Do not use for scientific work.

## Privacy

Fully local. Zero network requests, no analytics, no accounts.
