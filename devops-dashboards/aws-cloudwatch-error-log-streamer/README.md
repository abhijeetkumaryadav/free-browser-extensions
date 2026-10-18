# CloudTail — AWS CloudWatch Log Streamer

A polished popup for tailing AWS CloudWatch Logs: pick a log group, apply an error/warning filter (or a custom CloudWatch filter pattern), and stream the latest matching events — newest first, with timestamps and stream names. An optional 2-minute auto-refresh keeps the event count on the toolbar badge.

## Your keys, your device

CloudTail **requires your own IAM credentials** — nothing is hardcoded and there is no bundled credential of any kind.

- You enter an **access key ID**, **secret access key**, optional **session token** (for temporary credentials), and **region** in Settings.
- They are stored only in `chrome.storage.local` on your device.
- Every request is signed **locally in the extension** with SigV4 (pure WebCrypto, no libraries) and sent only to `https://logs.<region>.amazonaws.com`.
- "Forget keys" wipes everything from the device.

The IAM identity needs `logs:DescribeLogGroups` and `logs:FilterLogEvents`. The shipped SigV4 implementation was verified byte-identical against AWS's own SDK signer (botocore) for a fixed test vector.

## Install (developer mode)

**Chrome / Edge / Opera:**
1. Unzip `aws-cloudwatch-error-log-streamer.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:** this build targets Chromium's MV3. Core logic (WebCrypto SigV4 + fetch) is portable, but `host_permissions` for `*.amazonaws.com` and the alarms-driven worker need testing per browser.

## Use

1. Click the toolbar icon → **Settings** (gear).
2. Paste your IAM access key ID + secret (+ session token if using temporary credentials), set the region, enable auto-refresh if wanted, then **Save & connect** (it validates with a tiny signed call first).
3. Choose a log group, pick a filter preset or type a custom CloudWatch filter pattern, then **Tail logs**.

## Permissions — why each one

| Permission | Why |
|---|---|
| `storage` | Stores your credentials, region, last group/pattern, and cached events locally. |
| `alarms` | Drives the optional 2-minute background re-tail that updates the toolbar badge. |
| Host: `https://*.amazonaws.com/*` | Only network destination family: the CloudWatch Logs API endpoint for your region. |

## Publishing notes

- No remote code, no analytics, no bundled secrets.
- Never ship a build containing credentials — the fields are user-supplied only.
- Store listing should repeat: "Requires your own IAM credentials with logs:DescribeLogGroups and logs:FilterLogEvents; keys never leave your device."
