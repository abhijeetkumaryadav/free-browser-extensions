# BrakeTime — Infinite Scroll Braking for Kids

A kid-safety friction tool: on parent-chosen sites, BrakeTime adds gentle pauses to
endless scrolling — a "Take a breath" overlay after a set scroll distance, a tiny
scroll counter, and a session-time reminder. **Friction only: nothing is ever blocked,
filtered, or reported anywhere.**

## How it works

1. The parent sets a 4-digit PIN (stored as a local SHA-256 hash), a scroll-distance
   threshold, a pause length, and the list of monitored domains.
2. When a tab finishes loading on one of those domains, the content script starts
   tracking accumulated scroll distance.
3. At the threshold, a friendly overlay appears with a short countdown, then the kid
   continues scrolling. Stats (scroll px, breaks taken, minutes) stay in
   `chrome.storage.local`.

## Permissions (all justified)

- `storage` — settings, PIN hash, and stats.
- `scripting` + `<all_urls>` host — inject the brake script only on parent-configured
  domains (checked in the service worker before injecting).
- `tabs` — read the active tab's URL to decide whether to inject.

## Honest scope

- This is a family-agreement aid, not a lock: a tech-savvy kid can bypass any
  extension. Scroll tracking is approximate (throttled sampling).
- No content is read, no keystrokes captured, no network calls, no accounts.

## Install (developer mode)

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder.
3. Click the toolbar icon, open Parent settings, set your PIN.
