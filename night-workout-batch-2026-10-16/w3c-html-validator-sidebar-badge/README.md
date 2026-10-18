# HTML Lint Badge — Local Page Checker

One-click local HTML lint for the active tab. Flags common issues and shows the
count as a badge on the toolbar icon.

## Checks (heuristic, read-only)

- `<html>` missing `lang`
- `<head>` missing `<title>`
- missing `<meta charset>`
- `<img>` elements without `alt` text
- duplicate `id` attributes
- nested interactive elements (`<a>` inside `<a>`, etc.)
- `<li>` outside `<ul>`/`<ol>`
- empty headings

## Honest scope

- **Heuristic lint only — NOT W3C validation.** It catches common mistakes; it does
  not replace the real validator.
- The page is never modified — scanning is read-only.
- Click **Clear badge** to remove the toolbar badge.

## How to use

1. Open any normal web page, click the extension.
2. **Scan this tab** — issues list appears; the badge shows the count.
3. **Clear badge** — resets the badge and hides results.

## Privacy

- 100% local. Permissions: `storage` (prefs), `activeTab` + `scripting` (click-only scan).
- No network requests, no analytics.
