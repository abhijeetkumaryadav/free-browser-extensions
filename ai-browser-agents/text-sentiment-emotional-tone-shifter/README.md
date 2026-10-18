# ToneShift — Sentiment & Tone Tools (v1.0.0)

Rule-based sentiment analysis and template tone rewrites for pasted text.

## Features
- **Sentiment read**: lexicon-based positive/negative/neutral scoring (-100…+100) with a marker meter, word counts, and highlighted sentiment words.
- **Negation & intensifier aware**: "not good" flips polarity (dotted underline); "very good" scores higher.
- **Tone rewrites** (template regex swaps, all editable with before/after): Formal, Casual, Concise, Warm.
- Copy result / use-as-input; input draft autosaves locally.

## Honest scope
Heuristic word lists only — **not AI**. Sarcasm, idioms, and context can fool it. Nothing is sent anywhere; everything runs on-device.

## Install
1. Unzip `text-sentiment-emotional-tone-shifter.zip`.
2. Open `chrome://extensions` (or Edge `edge://extensions`).
3. Enable **Developer mode** → **Load unpacked** → select the unzipped folder.

## Permissions
- `storage` — autosave your input draft locally. That's it.

## Publishing notes
- Manifest V3, no remote code, no network calls — store-safe.
- Suggested store categories: Productivity / Communication.
