# Clickbait Demoter

A heuristic clickbait checker for the web.

## What it does

On your explicit click, scans result-like cards on the current page for clickbait signals and dims them (with a red dashed outline). Nothing runs automatically. One click restores the page exactly.

## Bundled heuristics

- All-caps titles
- Excessive punctuation (`!!`, `???`)
- Bait phrases ("you won't believe", "will shock you", …)
- List-bait numbers ("7 ways …")
- Keyword-stuffed repeated words

**Heuristic only** — misses and misfires are possible. It is a playful filter, not a judgment of the content.

## Privacy

- 100% local, zero network, no remote libraries.
- Permissions: `storage` (counters), `activeTab` + `scripting` (click-only injection).
