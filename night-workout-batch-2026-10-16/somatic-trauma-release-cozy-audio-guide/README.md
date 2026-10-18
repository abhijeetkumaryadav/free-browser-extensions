# Cozy Audio Guide — Relaxation Aid

A cozy, fully local relaxation audio guide for Chrome/Edge/Firefox/Opera (Manifest V3).

## What it does

- **Guided session**: 4 gentle phases (Settle In → Slow Breathing → Soften → Quiet Rest), about 8 minutes total, with per-phase countdowns, progress bar, and prev/next navigation.
- **Generated ambient tones**: a warm synthesized pad (detuned oscillators through a lowpass filter with a slow swell) and soft chimes on phase changes. All sound is synthesized live with the Web Audio API — **no audio files, no network, no recordings**.
- **Controls**: ambient on/off toggle, volume slider; preferences persist locally.

## Honest scope

> **Relaxation aid only — NOT therapy, NOT medical advice.**

This extension plays calming tones and shows gentle rest prompts. It does not assess, diagnose, or treat anything. If you're struggling, please reach out to a qualified professional or a local support line.

## Privacy

- 100% local. No network requests, no analytics, no accounts.
- Nothing is recorded or transmitted. `chrome.storage.local` holds only your volume/ambient preferences.

## Permissions

- `storage` — remember volume and ambient-toggle preferences.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI, styling, audio + session engines
- `icons/` — generated 16/48/128 PNG icons
- `README.md` — this file
