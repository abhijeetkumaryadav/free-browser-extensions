# Distraction Friction Blocker v1.0.0

A focus tool that adds a 10-second breathing pause before
distracting sites. Add sites to your blocklist (or hit **Block this
site** on any page); visiting one shows a full-page interstitial —
"Take a breath." — with a 10-second countdown. The **Continue
anyway** button only unlocks after the countdown, and **Go back** is
always one tap away. A per-site daily counter shows how many times
you paused today.

Fully non-destructive and reversible: remove a site from the
blocklist any time and it loads normally again. Everything stays
on-device.

## Try it
1. Unzip `distraction-friction-blocker.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Click the icon, add a distracting site, then visit it.

## Publishing notes
- Permissions: `storage` (blocklist + daily counters). The content
  script runs on all URLs so it can detect blocklisted sites, but it
  does nothing unless the site is on your list — nothing is read,
  changed, or uploaded.
- Chrome Web Store: $5 one-time dev fee. Same package loads in Edge
  and Firefox.
