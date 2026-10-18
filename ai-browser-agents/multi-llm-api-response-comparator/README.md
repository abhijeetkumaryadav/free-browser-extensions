# PromptBench — Multi-LLM Response Comparator

Compare responses from different large language models side by side — **manually**.
Paste one prompt, paste each model's response into its own panel, and get word stats,
pairwise similarity scores, and unique-phrase highlighting. Save comparisons and
export them as Markdown.

## What it does

- **Shared prompt box** — paste the prompt you sent to every model.
- **2–4 response panels** — each with an editable model label, response textarea,
  live word count, and a notes field.
- **One-click comparison** —
  - per-model stats: words, unique words, characters;
  - pairwise Jaccard similarity (content-word overlap) with a visual matrix;
  - **unique-word highlighting**: words that appear in only one response are
    highlighted in-place (toggleable).
- **Saved comparisons** — name and store up to 50 comparisons locally; load or
  delete them any time.
- **Markdown export** — copies the prompt, all responses, notes, and similarity
  scores to the clipboard.

## Honest scope

This is a **manual comparison tool**. It has no API keys, makes no network calls,
and cannot fetch responses from OpenAI, Anthropic, Google, or anyone else. You
paste everything by hand. Similarity is a simple token-overlap heuristic, not a
semantic judgment.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox** (temporary)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and choose `manifest.json`.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save comparisons and preferences on-device. Nothing else. |

No host permissions, no background page, no network access.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Privacy: all data stays in `chrome.storage.local` on the user's device.
- Store data-safety: no data collected, no data transmitted.
