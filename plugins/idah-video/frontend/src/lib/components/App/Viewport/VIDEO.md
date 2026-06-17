# Video subsystem

This subsystem handles frame-accurate video playback for annotators. The core
design principle is simple: annotators pause the video, rapidly jump between
frames to find the right one, and then mark it. We optimize for speed during
that frame-hunting phase (instant navigation) and full picture quality when
they stop on a frame (to see details for marking).

## Files

| File                                | Role                                                            |
| ----------------------------------- | --------------------------------------------------------------- |
| `Video.svelte`                      | Wraps the HTML `<video>` element, manages its lifecycle, and converts between frame numbers (what the app uses) and time in seconds (what the browser uses). |
| `video-stream-handler.ts`           | Manages the HLS video stream, decides what quality level to fetch, and handles the switching between low and high quality based on network speed. |
| `LoadingIndicator.svelte`           | Shows the user what's happening: displays a badge when upgrading to high quality, or a "Loading Frame" pill when waiting for a frame to appear. |
| `../../../state/viewport.svelte.ts` | Central state store that all other components read from and write to. All position changes, loading states, and playback status flow through here. |

## Design philosophy

### One source of truth

Every position change — whether from a toolbar button click, keyboard arrow key,
animation frame loop, or programmatic jump — updates a single number:
`viewport.video.currentFrame`. This is the "target" position the user wants to go to.

The video element, the annotation layer overlay, and the UI all read from this
same value, so they can never fall out of sync about where the user actually is
in the timeline. If they all pulled from different sources, the video might show
frame 50 while the annotation layer showed frame 47, causing confusing mismatches.

### Target vs. reality

There's an important distinction between what the user *wants* and what's
actually *showing* on the screen:

- **`currentFrame`** is what the user wants. It changes instantly when they
  press a key or click.
- **`displayedFrame`** is what's actually painted. It only changes after the
  browser loads the frame and renders it to the screen.

The annotation layer overlay reads from `displayedFrame` instead of `currentFrame`.
This prevents the overlay from jumping ahead of the actual video pixels — if you're
on frame 50 but the video is still loading frame 51, your annotations stay on 50,
not speculatively jumping to 51.

When these two values disagree (the user asked for a new frame but it hasn't
finished loading yet), the UI shows a "Loading Frame" pill to tell the user "your
request is being processed."

### High quality by default

The system keeps high-quality video in the buffer at all times. Here's how:

1. When the video first loads, it quickly grabs a few low-quality frames so the
   user sees *something* fast.
2. Once those frames arrive, the loader switches permanently to high quality,
   and every new fragment it downloads is full resolution.

This design means that when you jump between frames that are already loaded
(the common case), the video element pulls high-quality pixels straight from
the buffer — no network request, no quality switch, no flicker. You can step
frame-by-frame left or right and everything stays crisp.

**Low quality only appears as a fallback on slow networks:** If the system
measures that downloading one high-quality chunk would take longer than about
1 second, it shows a low-quality frame immediately to keep navigation snappy
(important on 3G/4G), then upgrades to high quality once you stop hopping around.
On a fast connection, low quality is never fetched after that initial burst.

Two implementation details from hls.js drive this:

- When you change quality, you can either flush the old data (`currentLevel`) or
  just change what future downloads fetch (`loadLevel`). We use `loadLevel` so
  the buffer never gets discarded — preventing the old bug where settling on a
  frame would trash the buffer and force a slow re-download.
- The HLS stream controller watches for browser seek events automatically and
  re-aims at the new position. We don't have to manually orchestrate seeks;
  the system just chases the frame position at the current quality level.

### The LQ range map

The browser's Media Source Extensions (MSE) don't tell you what quality level
each piece of buffered video came from — they just store bytes. So we keep our
own map that tracks which time ranges hold low-quality data.

We build this map by listening to actual fragment append events (what really
made it into the buffer), not just download requests (which might fail or get
cancelled). When we append a low-quality chunk, we mark that time range as LQ.
When we append high-quality data over it, we remove the LQ marking. If the
browser evicts data from the buffer, we clean up our map too.

When you jump to a frame, we check the map: "Is this frame's data high-quality?"
If yes, we're done — it paints instantly from the buffer. If no, we schedule an
upgrade to fetch and replace just that low-quality interval with high-quality
data (debounced so rapid key presses don't trigger a dozen upgrades).

### Frame numbering

The browser's video element thinks in time (seconds), but the annotation app
thinks in frames (frame 0, 1, 2, etc.). A small conversion layer translates
between them.

Internally, the video is one-based (starting at frame 1), so frame 0 in the app
maps to 1/fps seconds in the browser (e.g., if the video is 30 fps, frame 0 is
at 0.033 seconds). We also add a tiny extra offset to avoid landing exactly on
fragment boundaries, which can cause timing issues.

## States

### Playback status

| Status   | Meaning                                                |
| -------- | ------------------------------------------------------ |
| `play`   | The animation loop is running; frames advance automatically at the video's playback rate. |
| `pause`  | The animation loop is stopped; the user manually controls the position with seeks. |

The playback status drives almost everything else. When you toggle it:
- Switching to `play` starts an animation loop that updates the frame position
  as the browser plays the video.
- Switching to `pause` stops the loop and hands control to the user's keyboard
  and clicks.

The system also listens to the browser's native `play` and `pause` events on the
video element itself — so if the video naturally ends or something programmatically
pauses it, that feeds back into the same system.

### Frame state

- `currentFrame` — the target frame the user wants (changed instantly when they press a key).
- `displayedFrame` — the actual frame currently visible on screen (only updates when the browser confirms it's rendered).
- `framePending` — derived boolean: true if paused and the target and displayed frames differ (meaning a seek is in progress).

### Loading state

- `loading.highQuality` — a high-quality replacement for the current frame is
  being downloaded (upgrading from low quality).
- `loading.qualityLabel` — a human-readable label describing that quality level
  (e.g., "1080p" or "720p").
- `loading.buffering` — playback has stalled waiting for the next fragment(s) to
  download. This is the playback-time counterpart of `framePending` (which only
  fires while paused): during playback the target and displayed frames advance
  in lockstep, so it never differs. Driven by the video element's `waiting` /
  `playing` events, it also shows the "Loading Frame" pill.
- `framePending` (above) — a new frame was requested but hasn't rendered yet.

### Stream state (internal to the HLS layer)

The HLS handler tracks several internal flags:

- **Initial-load mode** — whether the very first fragments are still being
  downloaded. Once the first frame paints, we exit this mode and switch to
  full quality.
- **The LQ range map** (described above) — which time ranges in the buffer
  hold low-quality data.
- **Pending render** — whether we're waiting for fragments to arrive so we
  can upgrade a low-quality frame to high quality (or paint an LQ fallback
  while waiting for HQ).
- **Fragment in flight** — whether a download is currently happening. This
  helps distinguish "network is slow but working" from "network stalled."
  Only a low-quality download for the **frame the user is waiting on** (the
  fragment that covers the current seek target) is mirrored into
  `viewport.video.loading.fragmentInFlight` so the keyboard stepping system can
  pause stepping while that frame arrives. Downloads that don't cover the target
  — hls.js filling the buffer forward of the playhead, or a background HQ
  upgrade — do **not** set the flag: they must never block navigation. (Without
  this distinction, on a slow link the forward-fill after a jump would gate
  backward stepping until it finished — the 3G jump-to-last-then-step-back
  livelock.)

## Actions

This section describes what happens when the user or browser does something.
The inline code comments in each file cover the mechanical details.

### Initial load

When the video component first mounts:

1. The system immediately starts downloading a few low-quality fragments so
   the user sees *something* fast. (These early fragments also let hls.js
   measure bandwidth so it can make smart quality choices later.)
2. Once those LQ frames arrive and paint, the loader switches permanently to
   high quality and stays there.
3. The early LQ region is then "backfilled" — replaced with high-quality
   fragments covering the same time range.

From the user's perspective: they see a quick, blurry frame appear, then a
moment later it sharpens to full quality. After that, everything you see is
high quality (unless the network gets slow).

### Pressing play

When you press play:

1. The animation loop (RAF/rVFC) starts running. It updates the frame position
   on every frame that the browser decodes, so playback advances smoothly.
2. Any pending quality work (like an upgrade from LQ to HQ) is cancelled — we're
   playing, so there's no point upgrading a frame we've already moved past.
3. After a few seconds of stable playback, the system hands quality selection
   over to hls.js's adaptive bitrate algorithm. This algorithm automatically
   picks the best quality for your network speed (lower quality on slow networks
   to avoid buffering, higher quality on fast networks).
4. Whatever quality level the adaptive algorithm chooses, we record it in our
   LQ range map so we know which parts of the buffer are low-quality later.

### Pressing pause

When you press pause:

1. The animation loop stops. Playback halts.
2. The system syncs `displayedFrame` to whatever frame the video actually shows
   and re-seeks the element to that frame's exact time. The re-seek matters
   because the painted frame lags the playback clock by a frame or three while
   playing, so the pixels frozen at pause can be an earlier frame than the clock
   position. Snapping the decoder back onto the reported frame keeps the pixels,
   the pill, and the high-quality upgrade all in agreement — otherwise the image
   would visibly jump when high quality later re-seeks to the clock position.
   (This includes a special case: at the very end of the video, we use the
   last-frame position from the database metadata instead of what the browser
   reports, since the browser's duration can be slightly off, and we skip the
   re-seek there.)
3. The loader switches back to pinning high-quality downloads only (no more
   adaptive bitrate adjustments). Because the snap above leaves the element
   briefly seeking, the high-quality upgrade waits for that seek to settle before
   flushing (otherwise it would bail and skip the upgrade), then targets the same
   frame the pixels were just snapped to.
4. If the paused frame is in a low-quality region (according to our LQ map),
   we immediately upgrade it to high quality — no waiting, no debounce. You
   stop, you see quality.

### Seeking while paused

When you press an arrow key or click to jump to a different frame:

1. The target (`currentFrame`) changes immediately.
2. The browser is told to seek to that frame's timestamp.
3. The system waits for the browser to confirm it has painted the new frame,
   then updates `displayedFrame`.
4. The HLS handler looks at the target frame and decides what to do:

**Case 1: Buffered and high-quality (the common case)**
- The frame's data is already in the buffer and it's all high-quality.
- The decoder paints immediately from the buffer.
- Zero network requests, zero quality work, zero flicker. Just instant
  responsiveness.

**Case 2: Buffered but low-quality**
- The frame's data is in the buffer, but it's low-quality (according to our LQ map).
- The low-quality frame paints instantly for responsiveness.
- An upgrade is scheduled to fire 300ms after you stop seeking. This way, if
  you're rapidly stepping through frames with arrow keys, each new frame paints
  quickly without triggering a dozen quality upgrades.

**Case 3: Not buffered yet**
- The frame's data isn't in the buffer — we need to fetch it.
- On a fast network: the loader (already set to high-quality) simply downloads
  the missing fragment and the frame paints at full quality.
- On a slow network: see the "Slow-network fallback" section below.

### Slow-network fallback

When seeking to an unbuffered frame on a slow network, the system uses a
"predict-then-verify" strategy with one time budget (roughly 1 second):

**Predict: Should we try high-quality?**
- The system estimates how long it would take to download one high-quality
  fragment: `(fragment size) / (current measured bandwidth)`.
- If that estimate exceeds the budget (~1 second), skip the HQ attempt entirely.
  Jump straight to low-quality to paint something fast (important on 3G/4G).
- Otherwise, attempt high-quality.

**Verify: Did the prediction hold true?**
- If you predicted HQ would work, the system tries to load high-quality but
  watches the clock. The prediction only counted one fragment's bytes, but
  reality also includes playlist requests, init segments, and network latency —
  so a "fast" prediction can still turn out to be wrong.
- If the frame still isn't buffered when the budget expires, the system gives
  up on high-quality and switches to low-quality instead, painting something
  immediately.

**Remember: Learn from what happened**
- If the deadline expires, the system "latches": it remembers "HQ was too slow
  in this network state." Future unbuffered seeks now go straight to low-quality,
  skipping the failed HQ attempt entirely. (Without this, holding down an arrow
  key would repeatedly try HQ, burn the budget, fail, then paint LQ — wasting
  time with every step.)
- The latch clears when a high-quality fragment actually *completes* — proof
  that HQ is affordable again. The system then tries the predict-and-attempt
  approach again.

**Final presentation:**
- Whatever low-quality data lands is marked in the LQ map.
- The upgrade debounce (300ms) doesn't start until the low-quality frame is
  actually paintable — this prevents the upgrade from firing while the frame
  is still waiting for more data.
- The upgrade also never starts while the video element is actively seeking.
- From the user's perspective: a fast LQ frame with a tiny "LQ" badge appears,
  then a moment later the high-quality replacement (or just stays LQ if the
  network is very slow). You never wait more than ~1 second for *something*
  to appear.

### Upgrading to high quality

When a low-quality frame needs to be upgraded to high-quality:

1. **Identify and download:** The system looks at the LQ map, finds the
   time range holding low-quality data, and tells the loader to fetch
   high-quality fragments covering that range.

2. **Flush the decoder:** Once the high-quality data arrives, the decoder
   needs to re-decode it. The system triggers a "flush" — a seek to the
   same frame position — which forces the decoder to re-render using the
   new, high-quality data.

3. **Smart buffer management:** The flush is **surgical** — it only discards
   the low-quality data inside the buffered range that contains the frame.
   High-quality data elsewhere in the buffer (earlier or later frames) is
   left untouched. This is important: we're not throwing out the whole buffer
   and restarting, just removing the contaminated part.

4. **No visual gap:** Because the low-quality frame was already on screen when
   this started, the user never sees a blank frame. It just sharpens from
   blurry to clear.

5. **Wait for coverage:** The upgrade is considered done when the newly appended
   high-quality data covers the frame and a little bit beyond (hls.js needs
   some forward data to seamlessly decode). We judge completion by **actual
   buffered coverage**, not by counting fragments. This matters: if the gap is
   a single fragment surrounded by HQ data, hls.js just reloads that one
   fragment and goes idle — we need to wait for those bytes to actually arrive
   and be appended, not just requested.

### Rapid navigation (holding arrow keys)

When you press arrow keys to step through frames, the system is gated on the
**previous frame having already painted**. Here's why:

**The stepping gate:**
- While a seek is pending (the target frame hasn't rendered yet), further
  arrow key presses are **dropped** (not queued).
- This ensures the user only ever moves through frames they've actually seen.
  Annotations visibly track each frame. Without this gate, position would run
  ahead of the video, and the user would see a sudden jump of several frames
  when a slow load finally finishes.
- Dropped, not queued: if we queued steps, they'd replay invisibly later,
  recreating the exact jump the gate prevents.

**In the common case (buffered HQ):**
- Paint confirmation arrives on the very next video frame callback (~16ms).
- The gate is imperceptible and every step paints instantly from the buffer at
  zero cost in either direction.

**On a slow network:**
- Stepping is paced by low-quality fragments arriving. You get a continuous
  stream of LQ frames as you hold the arrow key.
- When you let go, the system upgrades to high-quality.
- Each new step cancels pending upgrades — but with a smart optimization: if
  the new frame falls inside an LQ fragment that's currently downloading, we
  keep that download and just retarget what we're waiting for. This means
  navigation redirects progress, never destroys it.

**Two "pressure valves" prevent the gate from trapping you:**

1. **Absolute jumps are never gated.** Clicking the timeline, typing a frame
   number, or using keyframe/note navigation always work immediately, even if
   a seek is pending.

2. **The stuck-seek timeout.** If a seek hasn't painted for a couple of seconds
   (network died mid-load), the gate gives up and lets more steps through.
   Slow stepping replaces lockout.

**The stuck-seek valve mechanics:**
- The valve opens only while **no paint-path fragment is downloading**. We
  distinguish paint-path downloads (a low-quality fragment that **covers the
  current seek target** — the frame we need to paint) from background work
  (settle upgrades, and forward buffer filling ahead of the playhead). Only the
  former sets the in-flight flag.
- When an escape step happens, it re-runs the quality logic, potentially
  starting new downloads. So the valve only opens after a full timeout window
  with zero paint-path activity.
- **Every transition of the "fragment in flight" flag re-arms the timeout
  window.** Between consecutive fragments (download complete → append → paint
  → next request), the flag goes false momentarily. Without re-arming, a
  key-repeat landing in that gap would slip through, jumping to a new fragment
  and discarding the one that just finished — the pixels would never advance.
  With re-arming, the valve truly opens only after a full window with *no*
  activity.

### The render watchdog

When the system is waiting for high-quality fragments to arrive during an
upgrade, in rare edge cases those fragments might never arrive (e.g., stale
bookkeeping says a range is LQ when it was actually replaced already).

To protect against hangs, every quality upgrade arms a **15-second inactivity
watchdog**:
- If nothing has been downloading for 15 seconds and the expected fragments
  still haven't arrived, the upgrade gives up.
- While data is actively moving (downloads happening, fragments arriving), the
  watchdog re-arms, so a slow but progressing high-quality load is never cut
  off prematurely.
- Only truly stuck renders time out.

## Feedback to the user

The loading indicator shows the user what's happening in two situations:

**High-quality replacement in progress:**
- A small badge appears in the corner.
- Hover it to see the quality level (e.g., "1080p").

**Seek in progress (or playback buffering):**
- A small pill appears with a spinner that says "Loading Frame".
- While paused, this tracks `framePending` (target frame requested but not yet
  painted). While playing, it tracks `loading.buffering` (playback stalled
  waiting for the next fragment), so the user gets the same feedback when the
  picture freezes mid-play.

Both indicators wait 150 milliseconds before appearing. This is important: most
frame seeks (jumping between buffered high-quality frames) happen instantly,
and you don't want an indicator flashing on and off constantly. Only if the
system is still waiting after 150ms does the indicator show.

Both disappear immediately when the work finishes.

## Public surface

The `Video.svelte` component exposes methods for direct control:

- `seekToFrame(frame)` — Jump to a specific frame number.
- `playbackRate(rate)` — Change playback speed (e.g., 1x, 2x, 0.5x).
- `setVolume(level)` — Set volume 0–100. 0 mutes.

Everything else flows through the `viewport.video` state object:

```ts
viewport.video = {
  // Position (frames and what's visible)
  currentFrame:   { value: 0 },   // target frame
  displayedFrame: { value: 0 },   // actual frame on screen
  framePending,                    // true if target != displayed
  
  // Playback control
  status: "play" | "pause",        // play/pause mode
  play(), pause(),
  goToFrame(frame),                // absolute jump (never gated)
  stepBy(delta),                   // relative step (gated while seeking)
  
  // Sound
  sound: { level, muted },
  
  // Loading feedback
  loading: { highQuality, qualityLabel }
}
```

**In plain English:**
- `status` is the play/pause switch.
- `currentFrame` and `displayedFrame` are the target and reality positions.
- `goToFrame()` and `stepBy()` are how you move around (goToFrame bypasses
  the step gate, stepBy respects it).
- `play()` and `pause()` control playback.
- Everything else is read-only feedback about what's happening.
