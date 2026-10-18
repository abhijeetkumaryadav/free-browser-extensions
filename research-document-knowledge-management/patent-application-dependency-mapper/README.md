# ClaimGraph — Patent Claim Dependency Mapper

Paste patent claims text and get an interactive dependency graph: independent vs dependent claims, dangling references, and one-click lineage tracing.

## What it does

- **Parses numbered claims** — each claim on its own line (`1. A device…`, `Claim 2. …`, `3) …`), with multi-line claims supported.
- **Detects references** — understands “claim 3”, “claims 1–4”, “claims 2, 5”, “claims 4 and 5”, “according to any of claims 1 to 3”.
- **Dependency graph on canvas** — layered layout (independent claims on top), green = independent, indigo = dependent, click any node to highlight its full chain (ancestors + descendants) and see its detail card.
- **Stats + warnings** — claim counts, independent/dependent split, and a warning listing references to claims not present in the text (dangling refs).
- **Sample + persistence** — one-click sample claims, last input restored on reopen.

Everything runs on-device. No network calls, no accounts, no tracking.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` in the unzipped folder. (Temporary: reload after each browser restart.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persists the last pasted claims text so it survives popup close. Nothing else is stored. |

No host permissions, no content scripts, no background page.

## Honest scope

- The parser is heuristic: unusual claim numbering or prose-style references may be missed. Always verify against the source document.
- This is a visualization aid, not legal software — it does not interpret claim scope or patentability.

## Publishing notes

- Manifest V3, single permission (`storage`), no remote code, no data collection — low review friction on the Chrome Web Store.
- Screenshots: popup with the sample claims mapped (graph + stats visible).
