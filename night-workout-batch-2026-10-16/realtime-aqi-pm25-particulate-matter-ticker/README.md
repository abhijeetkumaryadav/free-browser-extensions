# AQI Watcher — Air Quality Edu

Educational air-quality tool. **No live data**: nothing is fetched from the network.

## What it does
- **Scale guide**: US EPA AQI bands (0–500) with plain-language tips, plus a PM2.5 quick-reference guide.
- **Reading log**: log AQI values you check yourself (e.g. from a weather app or local station), optionally with PM2.5 µg/m³ and a note. Entries get color band badges, stats (count, latest, worst 7-day), and a clearable history.

## Honest scope
Educational only — your readings, not live data. General information, not health advice; follow local health authorities on smoky days.

## Privacy
Everything is stored in `chrome.storage.local`. No accounts, no network requests.

## Permissions
- `storage` — persists your readings on this machine.
