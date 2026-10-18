# Contrast Timer — Cold Plunge / Sauna

A configurable contrast-bath interval timer. Set cold seconds, hot seconds, and rounds; the timer alternates phases with chimes and keeps running in the background even when the popup is closed.

## What it does

- Alternating cold/hot phases (a round = one cold + one hot phase)
- Generated Web Audio chimes on phase change — no audio files
- Background alarms keep timing alive when the popup is closed; notifications announce phase changes then (service workers can't play audio)
- Skip-phase, end-early, and a session log of completed sessions
- Last-used settings are remembered

## Honest scope

**Timer only — NOT medical advice.** Cold exposure and sauna use carry real risks (cardiovascular strain, hypothermia, fainting). Consult a healthcare professional before starting, and stop immediately if you feel unwell.

## Permissions

- `storage` — settings + session log
- `alarms` — background timing
- `notifications` — phase-change alerts when the popup is closed

Everything runs locally. Zero network.
