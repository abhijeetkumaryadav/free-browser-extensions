# Peak Normalizer — Audio Volume Normalizer

Bring a too-quiet (or hot) recording to a consistent peak level with one click.

## How to use

1. Click the toolbar icon.
2. Choose an audio file (MP3, WAV, OGG, M4A… — one at a time).
3. The extension decodes it with Web Audio and shows the measured peak in dBFS.
4. Set a target peak (default −1 dBFS, range −12 to 0).
5. Press **Normalize & export WAV** — gain is applied so the file's peak hits
   the target, and a 16-bit PCM WAV downloads.

## Honest scope

- **Peak normalization of one file at a time** — it measures the loudest sample
  and applies a single gain value. It is not mastering: no compression, EQ,
  limiting, or loudness (LUFS) processing, and no multitrack mixing.
- Silent files cannot be normalized (gain would be infinite) — they are
  reported as-is.
- **Local only** — decoding, analysis, and WAV encoding all happen on your
  machine. No permissions, no network.

## Technical notes

- Manifest V3, zero permissions, single-file popup (no content script).
- WAV export is 16-bit PCM at the source sample rate and channel count.
- Built with Manifest V3 for Chrome / Edge; compatible with Firefox and Opera.
