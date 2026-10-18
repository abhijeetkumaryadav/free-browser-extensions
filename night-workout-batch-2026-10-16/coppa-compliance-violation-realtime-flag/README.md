# COPPA Red Flag

**Kid-site data-collection scanner** — an on-demand, parent-facing tool that scans the current
page for common kid-directed data-collection red flags using local heuristic pattern matching.

## What it does

Click **Scan this page** and the extension checks the active tab for:

1. **Age / birthdate collection** (red flag) — form fields asking for age, DOB, or birthday.
2. **Email / phone collection** (warning or note) — whether the page mentions parental consent.
3. **Location / address collection** (warning) — zip, postal code, address, or city fields.
4. **Likely third-party trackers** (warning or note) — scripts/frames from tracker-sounding domains.
5. **Missing privacy-policy link** (warning) — when the page collects personal info but links to no privacy policy.

Results are grouped by severity (Red flag / Warning / Note) with plain-language explanations.

## Honest scope

- Heuristic pattern matching **only** — it can miss issues and it can misfire.
- This is a **parent aid, not a legal compliance determination**. It does not decide whether a
  site complies with COPPA or any other law.
- The content script is injected **only** when you click the scan button, and only into the
  active tab. Nothing is read from pages otherwise.

## Privacy

100% local. No network requests, no analytics, no data leaves your device. Settings: none stored
beyond nothing at all — the extension keeps no persistent state.

## Permissions

- `activeTab` — scan the page you explicitly choose, only when you click the button.
- `scripting` — inject the one-shot scanner into that tab.
- `storage` — reserved for future settings; currently unused.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Open any http/https page and click the toolbar icon, then **Scan this page**.

## Publishing notes

- Manifest V3, no remote code, no data collection — store-friendly.
- Screenshots should show the scan results on a demo page you control.
