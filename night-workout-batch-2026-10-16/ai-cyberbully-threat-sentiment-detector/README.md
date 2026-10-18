# BullyShield — Cyberbully Threat Detector

A **defensive kid-safety aid**. Click "Scan this page" and it reads the visible text of the active tab, then flags possible bullying or threat signals using a **bundled local word-pattern list**.

## How it works

1. Click **Scan this page** — a content script extracts visible text (scripts, styles, and hidden elements skipped).
2. The popup matches the text against ~40 bundled patterns in four categories: **Threats** (severity 3), **Insults** (severity 2), **Exclusion** and **Taunts** (severity 1).
3. You get a verdict (None / Low / Moderate / High), per-category counts, and expandable flagged snippets with context.
4. A **What to do next** section gives plain-language parent guidance: read in context, talk to your child, save evidence, use block/report tools, and call emergency services if anyone is in immediate danger.

## Honest scope — read this

- This is **heuristic word-pattern matching, not AI**. It does not understand tone, sarcasm, jokes, or context.
- It can **miss** real bullying and **misfire** on innocent text. It is not a guarantee of safety.
- It is **not** a clinical, legal, or child-safety authority. Always review flagged content yourself.
- **Strict mode** adds extra low-severity taunt patterns (more flags, more noise).
- Scanning runs **only when you click**; page text never leaves the device; nothing is uploaded, logged, or transmitted.

## Permissions

- `activeTab` + `scripting` — extract visible text from the page you choose to scan.
- `storage` — remember your sensitivity setting.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder (or install the `.zip` via the same dialog).
3. Open a page, click the popup, and hit **Scan this page**.
