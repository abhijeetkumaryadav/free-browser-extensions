# Viral Growth Loop Mechanic Scanner

Growth-mechanics heuristic checklist for any landing page.

## What it does
- **Scan this page** — on explicit click, collects page text, buttons and links
  (read-only) and scores six bundled checks as HIT / PARTIAL / MISS:
  referral mechanics, share buttons, invite/team flows, user-generated content,
  rewards/gamification, network-effects surface.
- **Loop readiness score** — 0–100 composite with a plain-language verdict.
- **Tips** — each check includes a one-line design tip.

## Honest scope (read me)
- This is **heuristic pattern matching**, not analysis. It matches keyword
  patterns in text and controls; it cannot tell whether a flow actually works.
- It is **not growth advice**. Only real A/B experiments measure what converts.
- Read-only: the page is never modified. 100% local, no network calls.

## Permissions
`storage`, `activeTab` + `scripting` (scan on the tab you explicitly click on).
No host permissions.

## Install
1. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode.
2. "Load unpacked" → select this folder. Or load the `.zip` via "Load unpacked"
   after extracting.
