# Distraction Dog

A very good dog lives in your toolbar popup. It pops up at random intervals with
funny one-liners, bounces when it appears, and can be petted, fed treats, and asked
to do tricks. Counters track pets, treats, and distractions delivered.

**Clearly labeled fun: this dog does nothing useful.** It just wants you to know
it's a good boy.

## Features

- Cute PIL-drawn dog with 4 moods (happy, hungry, sleepy, love)
- Random-interval pop-ups while the popup is open (8s / 20s / 45s, with jitter)
- Pet / Feed / Trick interactions with unique responses
- Dismiss button (the dog always comes back — it's a dog)
- Stats: pets, treats, distractions delivered — saved on-device

## Install (development)

**Chrome / Edge / Opera:**
1. Download and unzip `standard-distraction-dog-popup.zip`
2. Go to `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox:** MV3 popups and `storage` work fine. No changes needed.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save pet/treat/visit counters and your settings on-device |

No host permissions. No content scripts. No background workers. No network calls.
The dog never phones home. The dog doesn't know how.

## Publishing notes

- Chrome Web Store: joke/fun extension, single purpose — fine for listing.
- Don't claim any productivity benefit in the listing. The benefit is the dog.
