# Text to Speech — Speed Reader (TTS)

Paste text or load a `.txt` file and listen with your browser's built-in speech
synthesis. Speed slider (0.5×–2×), voice picker, pause/resume/stop, live word
progress bar with a spoken-text ticker, and estimated listening time.

**Honest scope:** browser TTS — text only. This extension does **not** parse PDF
files. Voice quality and availability depend on your browser's installed voices.
Everything runs locally; no network calls, nothing uploaded.

## Features
- Paste text or load a `.txt` file (2 MB max)
- Voice picker with voice count
- Speed slider 0.5×–2× with estimated duration
- Play / pause / resume / stop
- Live word progress bar + spoken-word ticker (when the browser reports word boundaries)
- Remembers your last text, speed, and voice (chrome.storage.local)

## Headless engine tests
The engine functions (`splitWords`, `estimateSeconds`, `fmtDuration`,
`chunkText`, `wordsBeforeChunk` between `// ENGINE-START`/`// ENGINE-END`) were
tested headless: word tokenization incl. apostrophes, estimate math at rates,
duration formatting, chunking caps + tiny-tail merge, word offsets.
