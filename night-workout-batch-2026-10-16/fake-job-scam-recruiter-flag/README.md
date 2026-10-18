# Fake Job Scam Recruiter Flag

**Version 1.0.0** — A defensive anti-scam browser extension (Manifest V3).

## What it does

On-demand scan of a job posting page for common recruitment-scam signals:

- Upfront fee requests (registration, training, deposit, visa fees)
- Recruiters writing from free email services (Gmail, Yahoo, …)
- Contact only via WhatsApp/Telegram with no corporate channel
- High pay paired with "no experience needed"
- Urgency pressure ("immediate joining", "limited slots")
- Vague low-skill roles with thin descriptions
- Early requests for ID documents, bank details, or OTPs
- Task-based "pay to unlock/withdraw" patterns

The popup shows a 0–100 risk score with a verdict and per-signal explanations.

## Honest scope (read this)

- **Heuristic aid only — never a verdict.** These are pattern signals. A genuine posting can trip a signal; a real scam can avoid them all.
- Always verify employers independently: official website, corporate email domain, landline, registered address.
- Scans run only when you click the button. Nothing is scanned in the background.
- **100% local.** No network requests, no accounts. Only the last scan's summary (host, score, verdict) is stored locally — never page content.

## Privacy

- Permissions: `activeTab`, `scripting` (click-only content injection), `storage`.
- No data leaves the device.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest |
| `popup.html` / `popup.css` | 380px deep-dark glassmorphism popup |
| `popup.js` | Heuristic signal checks + scoring |
| `content.js` | Click-only data collector (text, emails, messenger mentions) |
| `icons/` | Generated 16/48/128 PNG icons |
| `README.md` | This file |

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked**, select this folder.
3. Open a job posting, click the extension, click **Scan this job page**.
