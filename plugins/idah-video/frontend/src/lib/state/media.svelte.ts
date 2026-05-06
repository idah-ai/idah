// ---------------------------------------------------------------------------
// media.svelte.ts — Reactive media info derived from the global driver
//
// Usage:
//   import { media } from "$lib/state/media.svelte";
//   console.log(media.fps, media.totalFrames);
// ---------------------------------------------------------------------------
import { driver } from "$lib/state/driver.svelte";

function readMeta(): Record<string, unknown> {
  return driver?.media?.metadata ?? {};
}

export const media = {
  get duration(): number {
    let val;
    if (val = (readMeta().duration as number)) { return val; }
    throw 'duration not set in metadata';
  },
  get fps(): number {
    let val;
    if (val = (readMeta().fps as number) ) { return val; }
    throw 'fps not set in metadata'
  },
  get width(): number {
    let val;
    if (val = (readMeta().width as number)) { return val; }
    throw 'width not set in metadata';
  },
  get height(): number {
    let val;
    if (val = (readMeta().height as number)) { return val; }
    throw 'height not set in metadata';
  },
  get totalFrames(): number {
    return Math.round(this.duration * this.fps);
  },
  get id(): string {
    return driver?.media?.id ?? "";
  },
};
