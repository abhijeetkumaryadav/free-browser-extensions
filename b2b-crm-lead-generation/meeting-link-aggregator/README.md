# Meeting Link Aggregator v1.0.0

Save meeting links with a title and scheduled time, join any call
with one click, see "starting soon" highlighting for meetings within
30 minutes, and get a system notification 10 minutes before each
meeting via `chrome.alarms` (reminders survive browser restarts).

## Try it
1. Unzip `meeting-link-aggregator.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon → **＋ Add** → paste a meeting link, set the time, save.
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on (MV3 supported in Firefox 109+).

## Publishing notes
- Permissions: `storage` (meetings on-device), `alarms` (reminder
  scheduling), `notifications` (the 10-min warning). No network calls.
- Chrome Web Store: $5 one-time dev fee; Edge and Firefox free.
