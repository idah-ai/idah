# Video subsystem

Frame-accurate video playback for an annotation workflow. The pieces below
exist to serve one design goal: annotators move between frames quickly while
paused, then settle on the one they want to mark. The system optimises for
that — instant response during navigation, full fidelity when they stop.

## Files

| File                                | Role                                                            |
| ----------------------------------- | --------------------------------------------------------------- |
| `Video.svelte`                      | The `<video>` element, its lifecycle, and frame ↔ time mapping. |
| `video-stream-handler.ts`           | The HLS stream and its quality decisions.                       |
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

### High quality by default

The buffer holds the highest quality level, always. After a short
low-quality burst paints the first frame, the loader is pinned to max
quality, and every fragment that enters the buffer from then on is HQ.
A paused seek into buffered territory therefore needs **no quality work
at all** — the decoder paints full quality straight from the buffer,
with no level switch, no flush, and no repaint nudge. Annotators can
step frame by frame in either direction without ever seeing a quality
flicker or a re-download.

Low quality exists only as a **slow-network fallback**. When the
measured bandwidth says one HQ fragment would take longer than a
threshold (~1 s by default) to download, an unbuffered seek paints LQ
first so navigation stays instant — the 3G/4G case — and upgrades once
the user settles. On a fast connection, LQ is never fetched after the
initial burst.

Two hls.js facts shape the whole implementation:

- `hls.currentLevel = N` force-flushes the buffer to switch
  immediately; `hls.loadLevel = N` only changes what future loads
  fetch. The handler uses `loadLevel` exclusively, so buffered data is
  never thrown away wholesale. (The old design switched `currentLevel`
  on every navigation settle, which flushed and re-downloaded the
  buffer constantly and caused visible frame jumps.)
- While load is started, the stream controller follows media `seeking`
  events on its own — aborting stale fragment requests and re-ticking
  at the new position — so unbuffered seeks need no manual
  orchestration: the loader chases the playhead at the pinned level.

### The LQ range map

One SourceBuffer holds exactly one quality per time range, and MSE does
not expose which level the bytes came from. The handler therefore keeps
its own interval map of low-quality territory, maintained from
`FRAG_BUFFERED` events — i.e. from what *actually landed* in the
buffer, not what was requested, so aborted or racing loads can't
corrupt it. Non-HQ appends add intervals; HQ appends subtract them;
ranges evicted from the buffer are pruned lazily.

The map answers the only quality question navigation ever asks: *is the
data under this frame full quality?* If yes, nothing happens. If no, a
debounced upgrade replaces just that interval.

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

- `loading.highQuality` — an HQ replacement for the current frame is
  being fetched.
- `loading.qualityLabel` — human-readable label of that quality.
- `loading.lowQualityFrame` — the frame on screen is backed by
  low-quality data (slow-network fallback or leftover playback data
  awaiting upgrade).
- `framePending` (above) — a seek hasn't painted yet.

### Stream state (internal to the HLS layer)

- The handler knows whether it is in **initial-load mode** (first
  fragments still coming in) and whether the user is paused.
- The **LQ range map** (above) tracks which buffered intervals hold
  non-HQ data.
- It tracks whether there is currently a **pending render** — a
  promise to repaint at HQ (or to hand off an LQ fallback to its
  upgrade) once enough fragments have arrived.
- It tracks whether a fragment is currently **in flight**, so it can
  tell a slow-but-progressing load apart from a stalled one.

## Actions

This section describes what happens in response to each thing the user
or browser can do. It is intentionally light on mechanics — the inline
comments in each file cover those.

### Initial load

When the component mounts, the stream pulls in a few low-quality
fragments so the first frame can paint as soon as possible (they also
warm up the bandwidth estimator). Once they arrive, the loader is
pinned to max quality for good, and the burst region under the first
frame is replaced with HQ. The user sees a fast LQ frame and, a moment
later, the HQ replacement — and from then on, everything buffered is HQ.

### Pressing play

Playback takes over. The RAF/rVFC loop starts ticking and updates
position on every decoded frame. The HLS layer cancels any pending
quality work and, after a few seconds of stable playback, hands quality
selection to HLS's adaptive bitrate algorithm — via `loadLevel`, so the
handoff itself never flushes or stutters. Whatever levels ABR appends
are recorded in the LQ range map, fragment by fragment.

### Pressing pause

Playback stops. The RAF loop stops with it. The position is
re-synchronised to whatever frame the video is actually showing,
including the special case of natural end-of-video where the
last-frame timestamp comes from database metadata rather than the
browser's reported duration. The HLS layer re-pins the loader to max
quality and — only if the paused frame actually sits on tracked LQ
data — upgrades it immediately, with no debounce.

### Seeking while paused

The target changes; the browser is asked to move to the new frame; the
system waits for confirmation that the frame has been painted before
updating `displayedFrame`. The HLS layer then looks at the target and
picks one of three cases:

1. **Buffered, clean — the common case.** The decoder paints HQ from
   the buffer. Zero network traffic, zero quality work, zero flicker.
2. **Buffered, but tracked LQ.** The LQ frame paints instantly; an
   upgrade is scheduled for 300 ms after the last seek, so holding an
   arrow key streams frames at full responsiveness and never upgrades
   mid-flight.
3. **Unbuffered.** Decided by measured bandwidth: on a fast network
   the loader (already pinned to HQ) simply fills the gap and the
   frame paints directly at full quality; on a slow network the
   handler paints LQ first (see below).

### Slow-network fallback

The fallback works predict-then-verify, with one budget governing both
halves:

- **Predict.** When one HQ fragment is estimated to take longer than
  the budget to download (manifest bitrate ÷ hls.js's continuously
  updated bandwidth measurement), the seek doesn't wait at all: the
  handler redirects the loader to level 0 and paints the target fast.
- **Verify.** When the prediction says HQ is affordable, the seek
  loads HQ directly — but under a deadline. The estimate only counts
  one fragment's bytes, and the real time-to-paint also includes
  playlist and init-segment requests plus round trips, so a "fast"
  prediction can still stall. If the target isn't buffered when the
  budget expires, the handler stops waiting and paints LQ instead.

Either way the appended level-0 range is recorded in the LQ map, and
only once the LQ data has actually landed does the 300 ms upgrade
debounce start (starting earlier could fire while nothing is buffered
and skip the upgrade). The user sees a fast LQ frame with an "LQ"
badge, then the HQ replacement when the network allows — and never
waits longer than the budget for *something* to appear once data
starts flowing.

### Upgrading to high quality

The upgrade replaces tracked LQ intervals with HQ fragments, then
flushes the decoder with a same-value seek so the new quality paints.
The flush is **targeted**: only the contaminated intervals inside the
buffered range containing the frame are dropped, via the same
`BUFFER_FLUSHING` event hls.js uses internally for evictions — the
buffer controller removes the data, the fragment tracker forgets it,
and the stream controller refills the gap at max quality. HQ data
elsewhere in the buffer survives untouched. Because the LQ frame is
already on screen when this starts, the user never sees a blank gap.

### Rapid navigation (holding arrow keys)

Each keystroke moves `currentFrame`. Inside buffered HQ territory —
the common case — every step paints full quality straight from the
buffer at zero cost, in either direction. Through LQ territory or
unbuffered territory on a slow network, the annotator sees a
continuous stream of LQ frames, and the HQ upgrade kicks in only when
they let go. Every keystroke cancels any in-flight upgrade work.

### The render watchdog

A quality replacement waits for fragment-loaded events that, in rare
states, may never come (e.g. stale bookkeeping says a range is LQ when
its data was already replaced). Every render therefore arms a
15-second *inactivity* watchdog: if nothing is downloading and the
expected fragments still haven't arrived, the render gives up. The
watchdog re-arms while data is moving, so a slow HQ load on a poor
connection is never cut off — only a truly stuck render is.

## Feedback to the user

The loading indicator surfaces three situations:

- **High-quality replacement in progress.** A small image badge
  appears in the corner. Hovering it reveals the quality label.
- **Seek in progress.** A subtle pill with a spinner reads "Loading
  Frame".
- **Low-quality frame on screen.** A persistent "LQ" badge, shown only
  while paused, warns that the frame's detail is reduced. It disappears
  the moment the HQ replacement lands.

The two transient states wait 150 ms before appearing, so fast buffered
seeks — the common case during navigation — never flash an indicator.
They disappear immediately once the work finishes.

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
  loading: { highQuality, qualityLabel, lowQualityFrame },
  framePending,                    // derived
  status: "play" | "pause",
  sound:  { level, muted },
  play(), pause(), goToFrame(frame),
}
```

The status is a switch; the frame is a position; the rest is feedback.
That's the whole vocabulary.
