# ARIA Lens — Semantic DOM Validator

Audit any web page for ARIA roles, accessible names, form labels, heading structure and semantic HTML issues. Everything runs locally in the page — no data leaves your browser.

## What it checks

**Errors**
- `<img>` without `alt`
- Buttons / links with no accessible name
- Form controls with no `<label>`, `aria-label` or `aria-labelledby`
- Invalid ARIA roles and invalid `aria-*` attributes
- Roles missing required attributes (e.g. `role="slider"` without `aria-valuenow`)
- Roles that need an accessible name but have none
- Focusable elements with `aria-hidden="true"`
- Duplicate `id` values

**Warnings**
- Placeholder-only form labels, empty-alt images
- Skipped heading levels, missing/duplicate `<h1>`, empty headings
- Positive `tabindex` values

**Notices**
- Missing `<main>` / `<nav>` landmarks

## Usage

1. Open the page you want to audit.
2. Click the ARIA Lens toolbar icon → **Audit this page**.
3. Review errors / warnings / notices, grouped and filterable.
4. Toggle **Highlight issues on page** to outline offending elements directly (red = error, amber = warning, blue = notice).

## Notes

- Accessible-name detection is a close approximation of the spec algorithm (aria-labelledby → aria-label → associated label → text content → title).
- Highlighting is best-effort: it re-runs the core checks and outlines matching elements.
- `chrome://` and extension pages cannot be audited (browser restriction).

## Permissions

- `activeTab` + `scripting` — inject the audit script into the current tab only when you click a button.
