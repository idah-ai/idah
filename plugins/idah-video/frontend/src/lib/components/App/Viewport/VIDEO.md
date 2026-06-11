# Video subsystem

Frame-accurate video playback for an annotation workflow. The pieces below
exist to serve one design goal: annotators move between frames quickly while
paused, then settle on the one they want to mark. The system optimises for
that — instant response during navigation, full fidelity when they stop.

## Files

| File                                | Role                                                            |
| ----------------------------------- | --------------------------------------------------------------- |
| `Video.svelte`                      | The `<video>` element, its lifecycle, and frame ↔ time mapping. |
| `video-stream-handler.ts`           | The HLS adaptive stream and its quality decisions.              |
| `LoadingIndicator.svelte`           | Feedback to the user about what the system is doing.            |
| `../../../state/viewport.svelte.ts` | The shared reactive state everything else writes to.            |

## Design philosophy

### One source of truth

Every position change — from a toolbar click, a keyboard shortcut, the
RAF loop, or a programmatic seek — flows through a single value:
`viewport.video.currentFrame`. The video element, the annotation layer,
and the UI all read from the same place, so they can never disagree
about where the user is in the timeline.

### Target vs. reality

The system distinguishes between *where the user wants to be* and
*what is actually painted on screen*:

- **`currentFrame`** is the target. It changes the instant the user
  acts.
- **`displayedFrame`** is reality. It changes only when the video
  element confirms the new frame has been rendered.

The annotation layer reads `displayedFrame` so overlays never jump
ahead of the pixels behind them. When the two disagree (a seek is in
flight), the UI surfaces that with a "Loading Frame" pill.

### Quality follows intent

The HLS layer's job is to read the user's intent from their actions
and serve the right quality at the right time:

- **Rapid navigation → low quality.** Frames must appear instantly.
- **Settled on a frame → high quality.** The annotator needs detail.
- **Playback → adaptive.** Let the network decide.

The system biases toward keeping *something* on screen rather than the
ideal something. It would rather show a low-quality frame for half a
second than a blank frame for ten.

### Frame numbering

The browser thinks in seconds; the rest of the app thinks in zero-based
frame indices. A small mapping layer translates between them. The video
is one-based internally, so frame `0` of the app lives at `t = 1/fps`
in the browser, plus a tiny nudge to avoid landing on a fragment
boundary.

## States

### Playback status

| Status   | Meaning                                                |
| -------- | ------------------------------------------------------ |
| `play`   | RAF loop owns position; frames advance on their own.   |
| `pause`  | The user owns position; seeks move the playhead.       |

The status drives everything else. Toggling it makes the system play
or pause; the DOM `play`/`pause` events on the element also feed back
into status, so natural end-of-video and programmatic pause land in
the same code path.

### Frame state

- `currentFrame` — target position.
- `displayedFrame` — what is actually on screen.
- `framePending` — derived: paused and the two disagree.

### Loading state

- `loading.highQuality` — a high-quality fragment is being fetched.
- `loading.qualityLabel` — human-readable label of that quality.
- `framePending` (above) — a seek hasn't painted yet.

These two signals power the loading indicator. They are independent:
a paused seek may finish at low quality (no `highQuality`), then a
moment later a high-quality fetch begins (no `framePending`).

### Stream state (internal to the HLS layer)

- The handler knows whether it is in **initial-load mode** (first
  fragments still coming in), **paused mode** (HQ-on-settle), or
  **playing mode** (ABR).
- It tracks whether there is currently a **pending render** — a
  promise to repaint at a particular quality once enough fragments
  have arrived.
- It tracks whether a fragment is currently **in flight**, so it can
  tell a slow-but-progressing load apart from a stalled one.

## Actions

This section describes what happens in response to each thing the user
or browser can do. It is intentionally light on mechanics — the inline
comments in each file cover those.

### Initial load

When the component mounts, the stream pulls in a few low-quality
fragments so the first frame can paint as soon as possible. Once those
arrive, the loader stops, and a high-quality version of that same frame
is fetched in the background. The user sees a fast LQ frame and, a
moment later, the HQ replacement.

### Pressing play

Playback takes over. The RAF/rVFC loop starts ticking and updates
position on every decoded frame. The HLS layer cancels any pending
quality work — high-quality fetches during navigation are no longer
relevant — and after a few seconds of stable playback hands quality
selection over to HLS's adaptive bitrate algorithm.

### Pressing pause

Playback stops. The RAF loop stops with it. The position is
re-synchronised to whatever frame the video is actually showing,
including the special case of natural end-of-video where the
last-frame timestamp comes from database metadata rather than the
browser's reported duration. The HLS layer immediately upgrades the
paused frame to the highest available quality, with no debounce —
when the annotator stops, they want detail now.

### Seeking while paused

The target changes; the browser is asked to move to the new frame; the
system waits for confirmation that the frame has been painted before
updating `displayedFrame`. In parallel, the HLS layer begins a
quality cycle:

1. **Now:** show low quality. If the new position isn't already
   buffered at LQ, fetch it. This is where the "frames appear
   instantly" guarantee comes from.
2. **Later:** if the user stops moving for 300 ms, upgrade to high
   quality.

Every new seek resets the 300 ms timer, so holding an arrow key
streams LQ frames continuously and never tries to upgrade in between.

### Upgrading to high quality

The HQ upgrade is a careful operation, because flushing the decoder
to a quality whose fragment hasn't arrived yet would briefly show a
blank frame. The system handles two cases:

- **The LQ frame is already on screen.** Fetch HQ, then flush.
- **The LQ frame is still being fetched.** Wait for it to land
  *first*, so the user always has *some* frame visible, then start
  the HQ fetch.

The user never sees a blank gap during a quality upgrade.

### Rapid navigation (holding arrow keys)

Each keystroke moves `currentFrame`. The seek effect fires; the HLS
layer cancels any in-flight HQ work and serves LQ. The 300 ms HQ
upgrade timer is reset on every keystroke. The annotator sees a
continuous stream of LQ frames at full responsiveness, and HQ kicks in
only when they let go.

### The render watchdog

Some seeks land on a position whose fragments are already buffered.
In that case the stream emits no fragment-loaded events at all — so a
render that's waiting on one would hang forever. To handle this, every
render arms a 15-second *inactivity* watchdog: if nothing is
downloading and the expected fragments still haven't arrived, the
render gives up. The watchdog re-arms while data is moving, so a slow
HQ load on a poor connection is never cut off — only a truly stuck
render is.

## Feedback to the user

The loading indicator surfaces two situations:

- **High-quality fetch in progress.** A small image badge appears in
  the corner. Hovering it reveals the quality label.
- **Seek in progress.** A subtle pill with a spinner reads "Loading
  Frame".

Both states wait 150 ms before appearing, so fast buffered seeks —
the common case during navigation — never flash an indicator. They
disappear immediately once the work finishes.

## Public surface

The `Video.svelte` component exposes a small API for the toolbar and
keyboard layer:

- `seekToFrame(frame)` — go to a specific frame.
- `playbackRate(rate)` — change playback speed.
- `setVolume(level)` — 0–100, mutes at 0.

Everything else is driven by writing to `viewport.video`:

```ts
viewport.video = {
  currentFrame:   { value: 0 },   // target
  displayedFrame: { value: 0 },   // reality
  loading: { highQuality, qualityLabel },
  framePending,                    // derived
  status: "play" | "pause",
  sound:  { level, muted },
  play(), pause(), goToFrame(frame),
}
```

The status is a switch; the frame is a position; the rest is feedback.
That's the whole vocabulary.
