# Manifest Linter — Web App Manifest Checker

Finds the current tab's `<link rel="manifest">`, fetches the manifest file,
and lints common fields with plain-language explanations.

## Honest scope

Lints the **manifest file only** — not the app, not installability. It checks:

- **name / short_name** — present, and warns if overly long
- **start_url** — present
- **display** — present and one of the valid values
- **icons** — present, with usable `sizes`, `type` set, and 192px+ / 512px+
  variants for install prompts and splash screens
- **background_color / theme_color** — present and valid hex colors

Results are grouped as errors / warnings / passes. If a page has no
manifest link, or the manifest isn't valid JSON, it says so plainly.

## Use

1. Open any regular `http(s)` page (internal `chrome://` pages have no web manifest).
2. Click **Lint this tab's manifest**.

Everything runs locally; the only network request is the manifest fetch
itself, which your browser would have made anyway.

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` · `icons/`
· `README.md`

## Privacy

100% local. No analytics, no remote libraries, no data leaves the machine.
