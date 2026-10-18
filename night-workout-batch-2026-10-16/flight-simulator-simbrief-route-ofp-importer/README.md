# Route String Parser — Flight Plan Analyzer

**What it is:** Paste a flight route string (e.g. `EGLL SID WOBUN UN864 KUDOS LFPG`) and get a parsed waypoint list with type tags (APT / FIX / AWY), leg counts, and a distance estimate.

**Honest scope:** It parses **what YOU paste** — no SimBrief connection, no live data, no network. Distance is computed with haversine math **only between airports in the bundled 29-airport database**; fix and airway legs are counted but honestly labeled as unmeasurable.

## Features
- Tokenizes and classifies each route element (airport, fix, airway, DCT)
- Leg count + known nautical-mile distance, with an "unmeasurable legs" note
- Last route remembered locally; zero network

## Testing
Headless engine tests (node) cover: tokenizing, classification, airport DB lookup, haversine math (JFK–LHR ≈ 3,000 nm), leg counting, unmeasurable-leg counting, and invalid input.
