# Deep Work Friction Blocker

A focus-session tool that adds **friction instead of a hard block**. During a session, navigating to a listed distracting site shows a 10-second breathing pause ("Breathe. Do you really want this?") — then lets you proceed or go back. Nothing is locked; you control everything.

## Features

- **Focus sessions**: 15 / 25 / 50 / 90-minute timers with a live countdown in the popup
- **Friction screen**: full-page pause with a 10-second countdown and a "Proceed anyway" option
- **Editable site list**: starts with common social sites (x.com, instagram.com, facebook.com, tiktok.com, reddit.com, youtube.com, linkedin.com, twitter.com); add or remove any domain. Subdomains match automatically.
- **Alarms-powered**: session end is scheduled via `chrome.alarms`, so it works even if the popup closes

## Honest scope

- This is **friction, not a lock**. It will never permanently block a site or stop you from proceeding — it only asks you to pause for 10 seconds first.
- You start and end sessions explicitly. No auto-start, no silent blocking.
- 100% local. No network calls, no analytics, no data leaves your browser.

## Permissions

- `storage` — saves your site list and session state
- `tabs` — detects when you navigate to a friction site during a session
- `alarms` — schedules session end

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — session control + site list UI
- `background.js` — service worker that redirects friction-site navigations during sessions
- `friction.html` / `friction.js` — the 10-second breathing-pause page
- `icons/` — generated PNG icons
