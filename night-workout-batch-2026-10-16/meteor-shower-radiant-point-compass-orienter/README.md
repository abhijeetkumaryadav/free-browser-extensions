# Radiant Point — Meteor Shower Compass Orienter

**Approximate geometry only — educational.**

Enter your latitude/longitude and a date & time. The extension computes each
major meteor shower's radiant **altitude**, **azimuth**, and **compass direction**
using local spherical-astronomy math (Julian date → GMST → local sidereal time
→ hour angle → alt/az) on a bundled table of 9 major showers.

- Showers currently in their active window are highlighted and sorted first.
- "FACE NNE" tells you which way to face; meteors streak *away* from the radiant.
- Your location is stored locally (`chrome.storage.local`).

**Limits:** bundled radiant data is approximate (J2000); no precession
correction, no weather awareness, no moonlight factor. Not a prediction tool —
a "which way do I look" aid.

## Permissions
- `storage` — remember your latitude/longitude.

## Files
`popup.html` / `popup.css` / `popup.js` (astronomy engine between
`// ENGINE-START //` and `// ENGINE-END //`), `README.md`, `icons/`.
Manifest V3, zero network.
