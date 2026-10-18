# SmoothGlide — Custom Scroll Curve

A smooth-scroll enhancer that applies a custom easing curve (easeOutCubic) to
wheel scrolling on the current tab. Adjustable glide intensity and scroll speed.

## Honest scope

- **Page-scroll only.** This extension cannot change your OS mouse settings,
  trackpad speed, pointer acceleration, or system scroll direction. It only
  smooths in-page wheel scrolling for the tab you enable it on.
- Applies per tab, on your click (activeTab). Switching tabs requires
  re-enabling on the new tab.
- Form fields (textareas, selects, editable areas) and nested scrollable
  containers are left untouched and scroll natively.

## Install (developer mode)

1. Download and unzip `mouse-scroll-velocity-curve-modifier.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

Firefox: the extension uses `chrome.scripting.executeScript`, which works in
Firefox with the `browser` namespace shim absent here — Chrome/Edge/Opera
recommended. Firefox support is best-effort.

## Usage

1. Open the tab you want to smooth.
2. Click the SmoothGlide toolbar icon.
3. Flip **Smooth scrolling** on.
4. Tune **Glide intensity** (1–10: longer, softer glide) and **Scroll speed**
   (30–250% multiplier). Changes apply live.
5. Toggle off to restore native scrolling exactly.

## Permissions

- `storage` — remembers your intensity/speed settings locally.
- `activeTab` — lets the popup act on the tab you clicked it on.
- `scripting` — injects the (fully self-contained) scroll function on your
  explicit toggle. No content scripts run in the background; injection only
  happens when you flip the switch.

No network requests. No data leaves your device.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Store reviewers: the wheel interceptor is installed only on explicit user
  gesture and is fully removed when toggled off.
