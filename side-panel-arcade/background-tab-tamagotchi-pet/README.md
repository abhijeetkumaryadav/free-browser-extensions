# PixelPal — Virtual Pet

A tiny virtual pet living in your browser toolbar. Feed, play, clean and rest it. Stats decay over time while your browser is open — it's just a game.

## Install (unpacked)

1. Download and unzip `background-tab-tamagotchi-pet.zip`.
2. Open `chrome://extensions` (Chrome/Edge) or `about:debugging#/runtime/this-firefox` (Firefox).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.
5. Pin the toolbar icon and click it to meet your pet.

## How it works

- **Feed** restores hunger, **Play** boosts happiness (costs energy), **Clean** restores health, **Rest** toggles sleep (energy recovers while sleeping).
- Stats decay in real time but are only *computed when you open the popup* — there is no background tracking, no alarms, no always-on process.
- The pet's canvas sprite changes mood: happy, hungry, sad, sleepy, sick, sleeping.
- If health hits zero the pet passes away — press **Clean** to adopt a new one. Name it with the pencil button; age is tracked in days.

## Permissions

- `storage` — saves pet stats on your device only. Nothing is uploaded anywhere.

## Publishing notes

- No host permissions, no remote code, no network calls. Safe for Chrome Web Store / Edge Add-ons / Firefox AMO review.
