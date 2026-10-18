# Hydroponic Nutrient Dosing Calculator

A pure-local calculator for hydroponic nutrient dosing: enter reservoir size, current and target EC, and your nutrient's strength to get exact ml dosing, PPM conversions, dilution guidance, and the correct mixing order.

## Features

- **Dose math** — EC rise needed → ml per litre → total ml, split across 1/2/3-part nutrient systems
- **PPM conversion** — 500 (NaCl) and 700 (KCl) scales
- **Dilution helper** — if you're already over target EC, computes how much plain water to add
- **Mixing order guide** — silica → Cal-Mag → A → B → additives → pH last
- **Remembers inputs** — values persist locally between opens
- **100% local** — no network, no accounts

## Honest scope

This tool computes **estimates** from the numbers you enter. Real nutrient strength varies by brand, water source, and temperature — always verify with a calibrated EC/pH meter and start with lower doses on young plants. It is a calculator, not agronomic advice.

## Install

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder (or use the `.zip` for store upload)
3. Click the toolbar icon to open the 380px popup

## Permissions

- `storage` — remembers your last inputs locally. That's it.

## Privacy

Nothing leaves your device. No server, no analytics, no remote code.
