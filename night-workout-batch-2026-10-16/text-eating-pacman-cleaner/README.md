# Text-Eating Pac-Man Cleaner

A harmless page toy: release Pac-Man and he sweeps across the page in a
serpentine path, chomping text nodes with a munch animation while a score
counter tallies every character eaten. **Fully reversible:** text nodes are
wrapped in spans (never destroyed) — **Restore text** unwraps them all and
every word comes back.

## How to use

1. Load the extension (chrome://extensions → Developer mode → Load unpacked).
2. Open any text-heavy page and click the extension icon.
3. Set **Munch speed**, then hit **Release Pac-Man**.
4. Watch the score climb. Hit **Restore text** to bring all words back.

## Honest scope

- Pure visual toy. "Eaten" text is hidden with a shrink/fade animation; the
  underlying text nodes are preserved and restored exactly.
- No audio (no autoplay), no network, no tracking.
- Runs only when you click Release (injected via `chrome.scripting`).

## Permissions

- `activeTab` + `scripting` — inject the Pac-Man script into the current tab on demand.
- `storage` — remember speed setting and mirror the live score to the popup.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup with score
- `content.js` — text-node collection, sweep path, chomp animation, restore logic
- `icons/` — generated PNG icons (16/48/128)
