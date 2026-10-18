# KidTrack Shield — Ad Tracker Exposure Score

A kid-friendly privacy helper. One click scans the current page and shows a
**0–100 exposure score** with a simple verdict, plus counts of third-party
requests, tracking pixels, and tracker hosts it spotted.

## How it works

1. Click the toolbar icon → **Scan this page**.
2. A content script (injected on demand, only on click) reads the page's
   Resource Timing entries and images to find:
   - third-party requests (hosts different from the page's own domain),
   - likely tracking pixels (tiny 1–2px, hidden, or suspiciously named images),
   - hostnames matching a bundled **sample** list of well-known tracker domains.
3. The popup computes a score, a kid-readable verdict, and kid-friendly tips.

## Honest scope

- This is a **heuristic estimate**, not a security audit.
- The tracker list is a built-in **sample list** — it can miss real trackers and
  flag harmless ones.
- Nothing is blocked, changed, or reported anywhere. Observe-only.
- 100% local: no network calls, no accounts, nothing leaves the device.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remember the last scan so it survives popup close |
| `activeTab` | Scan only the tab you click on |
| `scripting` | Inject the scanner on demand (click only) |

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Pin the extension, open any website, click the icon, and scan.
