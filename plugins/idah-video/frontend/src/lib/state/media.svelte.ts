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
    return (readMeta().duration as number) ?? 0;
  },
  get fps(): number {
    return (readMeta().fps as number) ?? 25;
  },
  get width(): number {
    return (readMeta().width as number) ?? 0;
  },
  get height(): number {
    return (readMeta().height as number) ?? 0;
  },
  get totalFrames(): number {
    return Math.round(this.duration * this.fps);
  },
  get id(): string {
    return driver?.media?.id ?? "";
  },
};
