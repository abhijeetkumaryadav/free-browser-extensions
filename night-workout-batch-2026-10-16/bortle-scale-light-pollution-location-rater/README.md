# Bortle Scale Rater — Dark Sky Spots

A personal journal for rating the darkness of your stargazing spots on the
Bortle scale (1 = darkest, 9 = inner-city), plus a built-in reference guide.

## Honest scope

**Your ratings — educational only.** This is a personal journal, not a
light-pollution map and not a scientific survey. The Bortle guide is a
plain-language reference of the standard 1–9 scale.

## Features

- **Bortle Guide**: all nine classes with titles and plain-language descriptions
- **Journal**: rate spots (name, Bortle class picker 1–9, optional notes),
  newest-first list, per-entry delete
- **Stats**: spots rated, average Bortle, darkest spot
- Color-coded badges: deep blue (dark) → orange (bright)
- All data stored locally in `chrome.storage.local`; zero network

## Permissions

- `storage` — save your ratings locally

## Development

- Manifest V3, no deprecated APIs
- Popup 380px, deep-dark glassmorphism, one accent (#fbbf24), Lucide-style outline icons
- Engine functions (`BORTLE`, `bortleInfo`, `ratingColor`, `makeRating`,
  `sortRatings`, `avgRating`, `darkestSpot`, `fmtDate`) live between
  `// ENGINE-START` / `// ENGINE-END` and are headless-testable (25/25 checks pass)
