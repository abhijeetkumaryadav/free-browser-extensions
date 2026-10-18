# Dew Point Calculator — RH & Condensation Risk

A local dew-point calculator: enter air temperature and relative humidity to get the
dew point, the dew-point spread, and plain-language condensation / frost risk notes.

**Standard formula — estimates only, not weather advice.** The engine uses the
Magnus formula (Alduchov–Eskridge constants a=17.625, b=243.04):

    γ = ln(RH/100) + a·T / (b + T)
    Td = b·γ / (a − γ)

Interpretation:
- **Spread (T − Td)**: the smaller it is, the closer the air is to saturation.
- **Frost risk** is flagged when the dew point is at/below freezing.

## Features
- °C / °F toggle, inputs remembered locally
- Dew point, spread, frost-risk label, condensation note
- Humidity gauge visualization
- 100% local — zero network, no permissions beyond `storage`

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI + Magnus engine (between `// ENGINE-START` and `// ENGINE-END`)
- `icons/` — generated 16/48/128 PNG icons

## Install (developer mode)
1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable Developer mode
3. "Load unpacked" → select this folder
