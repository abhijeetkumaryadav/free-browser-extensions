# Local Farmers Market Finder

**Farmers Market Finder** — keep a personal directory of farmers markets and browse a seasonal produce guide. 100% local, no live data, no network.

## What it does

- **Markets tab** — add, edit, search, and delete farmers markets (name, location, days/hours, notes). Data persists in `chrome.storage.local`.
- **Sample data labeled** — three bundled sample listings are clearly marked `SAMPLE`; add your own local markets.
- **Seasonal tab** — month-by-month seasonal produce guide (fruits + vegetables), labeled as general Northern-hemisphere guidance.

## Honest scope

- There are **no live market listings** and no external data sources — this is a personal directory you maintain yourself.
- Seasonal guidance is general and varies by region.

## Permissions

- `storage` — saves your market directory locally.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.

## Design

380px popup, deep-dark glassmorphism, one green accent (`#22c55e`), Lucide-style stroke icons, generated 16/48/128 PNG icons.
