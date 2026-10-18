# METAR/TAF Decoder — Paste & Read

Paste raw METAR or TAF text and get a plain-language decode of wind, visibility, clouds, temperature/dew point, and pressure. **Decodes only what YOU paste — there is no live weather feed and nothing is fetched.**

## Features

- Auto-detects METAR vs TAF
- Decodes ICAO station, observation/valid times, trend groups (TEMPO, BECMG, NOSIG)
- Wind (incl. variable + gusts), visibility (m, SM, CAVOK), cloud layers (incl. CB/TCU), temperature/dew point, QNH/altimeter, common weather codes
- Remembers your last paste locally

## Limitations

- Heuristic decode of common groups only; unusual groups may be skipped
- **Not for flight planning** — always use official sources
- Fully offline, zero network
