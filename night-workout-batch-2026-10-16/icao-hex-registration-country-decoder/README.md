# Mode-S Hex Decoder — Country of Aircraft Code

**What it is:** An educational popup that decodes an ICAO 24-bit Mode-S hex code (the permanent transponder address of an aircraft) to its **country allocation block**. Type a code like `A4B5C6` and it tells you the country, e.g. United States.

**Honest scope:** Educational only — **no live tracking, no receiver, no positions**. Nothing leaves your browser; the prefix table is bundled in the code (a selected subset of ICAO allocations).

## Features
- Live decoding as you type; handles lowercase and `0x` prefixes
- Country, block range, and a short note per match
- Personal code log with notes, persisted in `chrome.storage.local`
- No permissions beyond `storage`; zero network

## How hex codes work
A 24-bit ICAO address is permanently assigned to an aircraft's transponder. ICAO allocates address **blocks by country**, so the first hex digits identify where the aircraft is registered — e.g. codes starting `A` are US, `7C` Australia.

## Testing
Headless engine tests (node) cover: normalization, valid/invalid input, longest-prefix matching, all bundled country blocks, and unknown-prefix behavior.
