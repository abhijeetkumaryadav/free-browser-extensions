# ThrottleWatch — Pod Resource Throttle Warner

A polished Manifest V3 browser extension that analyzes pasted `kubectl top pods`
output (or CSV) and flags pods approaching their CPU/memory limits with
throttle-risk severity badges. **It never connects to a cluster** — it is a
manual-paste analyzer, 100% local.

## Install (developer / unpacked)

**Chrome / Edge / Opera**
1. Download and unzip the release ZIP.
2. Open `chrome://extensions` (or `edge://extensions`, `opera://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json`.

## How to use

1. Set your per-pod **CPU limit (millicores)** and **Memory limit (MiB)** plus the
   **Warn** / **Critical** percentage thresholds.
2. Paste `kubectl top pods` output (the `kubectl` tab) or CSV
   `pod-name,cpu_millicores,memory_Mi` (the `CSV` tab). A **Sample** button loads
   example data.
3. Click **Analyze**: pods are listed worst-first with CPU/MEM usage bars and
   OK / Warning / Critical badges, plus summary counts.
4. Click the download button to export a `.txt` report.

## Input formats

**kubectl** — the exact output of `kubectl top pods`:
```
NAME                        CPU(cores)   MEMORY(bytes)
api-7d9c8f4b5-x2kqz          12m          128Mi
worker-5b6a9c2d-h8tnv        1            2048Mi
```
CPU accepts `m` (millicores) or plain cores; memory accepts `Ki/Mi/Gi`
(and plain bytes).

**CSV** — one pod per line:
```
api-7d9c8f4b5-x2kqz,12,128
worker-5b6a9c2d-h8tnv,1000,2048
```
Plain numbers mean millicores / MiB; `m` / `Mi`-style suffixes also work.

## Honest scope

- This tool works **only on data you paste**. It cannot and does not connect to
  any Kubernetes cluster, API server, or cloud account.
- Severity is a simple usage ÷ limit ratio — it is a *risk hint*, not a
  guarantee that throttling or OOMKills will occur. Real scheduling behavior
  depends on requests/limits, node pressure, QoS class, and more.

## Permissions — justification

| Permission | Why |
|---|---|
| `storage` | Remembers your pasted input, format tab, limits and thresholds. |

No network access at all. No data ever leaves your device.

## Publishing notes

- MV3 only; works in Chrome/Edge/Opera and Firefox (temporary load).
- No host permissions required — the extension is fully offline, which
  simplifies store review.
