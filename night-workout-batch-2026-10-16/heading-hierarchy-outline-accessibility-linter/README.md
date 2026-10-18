# Outline Linter — Heading Hierarchy Accessibility Checker

On-demand accessibility linter for the heading structure of any page. Click **Scan heading structure** and it analyzes every `h1`–`h6` on the tab, flags structural issues with concrete fix guidance, and shows an interactive document outline you can click to jump to any heading.

## Checks (structural only)

- **Skipped levels** (error) — e.g. H2 followed directly by H4. Screen readers and the document outline break when levels are skipped.
- **Empty headings** (error) — headings with no accessible text (inner text, `aria-label`, or `img alt`) confuse screen-reader navigation.
- **Multiple H1s** (warning) — best practice is one H1 per page describing the page topic.
- **First heading isn't H1** (warning) — the first heading on the page should normally be the page title.

## Interactive outline

The document outline renders every heading nested by level. Click any row to smooth-scroll to it and flash it on the page — handy for auditing long articles, docs, and CMS pages.

## Honest scope

- **Read-only analysis** — the page is never modified; the highlight outline is temporary.
- Structural patterns only: it **cannot judge whether heading wording is meaningful** or whether a multi-H1 page is intentional (some CMS templates do this legitimately).
- 100% local, zero network.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your last scan locally |
| `activeTab` | Scans only the tab you click on |
| `scripting` | Injects the on-demand heading analyzer |

## Privacy

No analytics, no accounts, no remote servers. Scan results stay in `chrome.storage.local` on your device.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — linter UI and report rendering
- `content.js` — on-demand heading analyzer + reveal helper
- `icons/` — generated PNG icons (16/48/128)
