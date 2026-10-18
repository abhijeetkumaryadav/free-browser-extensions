# Wind Gust Battery Drain — Safety Return Estimator

A simple drone battery model: enter capacity, hover current, headwind, cruise
speed, outbound distance and a reserve margin — get hover endurance, leg times,
round-trip energy use, and a SAFE / MARGINAL / UNSAFE return verdict.

**Scope (honest): estimates only — not flight planning.** A simplified drain
model with a heuristic wind penalty. It does not know your airframe, air
temperature, battery age/health, or gust structure. Always follow your drone's
manual and land well before warnings.

- Manifest V3, fully local (zero network). Permissions: `storage` only
  (remembers your last inputs).
- UI: 380px deep-dark glassmorphism, one orange accent (`#f97316`),
  Lucide-style outline icons.

## Model

- Hover endurance = (capacity mAh / 1000 / hover A) × 60 min
- Headwind raises current draw heuristically: `1 + 0.6·(wind/cruise)²` outbound;
  tailwind helps slightly: `max(1 − 0.3·(wind/cruise), 0.7)` on return
- Ground speed = cruise ± wind; if wind ≥ cruise, the outbound leg is impossible
- Verdict: SAFE if remaining-after-reserve ≥ 10%, MARGINAL if ≥ 0%, else UNSAFE
