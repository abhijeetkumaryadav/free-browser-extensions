# MetaTag Keyword Analyzer

An on-demand **self-audit** of the current page's own on-page SEO: meta tags, keyword density, and tag-length checks.

## What it does

- Click **Scan this page** to audit the active tab's own markup
- Shows `<title>`, `meta description`, and `meta keywords` with character counts against common guidelines (30–60 / 120–158)
- Computes the page's top keywords with density %, flags possible keyword stuffing (>3%)
- Checks: Open Graph completeness, canonical link, robots meta, and whether the top keyword appears in title/description
- 0–100 score, plain-language fix guidance, last scan persists locally

## Honest scope

- **Self-audit only**: analyzes the page you have open — it never scrapes, fetches, or compares other sites
- **Heuristic guidelines**, not ranking guarantees: length targets and density thresholds are industry rules of thumb
- **Read-only**: the page is never modified
- 100% local — zero network requests, no data leaves this device

## Permissions

- `activeTab` + `scripting` — inject the audit script only when you click Scan
- `storage` — remember your last scan

## Install

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder (or drag in the `.zip`)
