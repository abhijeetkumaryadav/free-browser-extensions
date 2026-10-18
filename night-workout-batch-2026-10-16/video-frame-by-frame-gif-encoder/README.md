# Frame GIF Encoder — Video to GIF

Pick a local video file, set frame count / width / frame delay, and encode a GIF entirely on your device. Uses a bundled pure-JS GIF89a encoder (median-cut 256-color palette + LZW compression). No libraries, no network.

## Honest limits

- **Frame extraction only.** Caps: **320px wide, max 24 frames**, 200 MB file cap.
- Large videos encode slowly — quantization is CPU-bound and can take a minute or more.
- GIFs are 256 colors; gradients and fine detail band. Quality is intentionally capped for sane file sizes.
- Animated GIF preview loops forever.

## Privacy

Fully local. No permissions at all. Your file is read via an object URL and never leaves the device.
