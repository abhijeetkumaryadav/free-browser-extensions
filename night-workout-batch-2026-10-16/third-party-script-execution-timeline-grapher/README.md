# Third-Party Script Timeline

Lists third-party `<script>` resources loaded by the current tab and renders their
**load timings** (PerformanceResourceTiming) as a horizontal timeline bar chart,
plus a per-host summary with counts and total load time.

## Honest scope

- **Load timing only — not execution profiling.** It shows when each script file
  started and finished downloading. It cannot show how long scripts ran or what
  they did.
- A "third party" here means a script hosted on a different hostname than the page.
  CDN subdomains of the same site are treated as first-party-ish (same suffix).
- Resource timing is capped by the browser's buffer; very old navigations may be
  incomplete.
- Nothing runs until you click **Scan this tab**. Internal pages
  (`chrome://`, `about:`) cannot be scanned. 100% local, zero network.

## Use

1. Open any page, click the extension icon.
2. Click **Scan this tab**.
3. The timeline shows each script's download bar; the list below groups by host
   with total and slowest-script times. **Clear** resets the view.

## Permissions

- `storage` — remembers nothing sensitive; used only for future settings.
- `activeTab` + `scripting` — inject the scanner into the tab you click on, only.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI, timeline rendering
- `content.js` — page-side resource-timing reader (boot-once guard)
- `icons/` — 16/48/128 PNG icons
