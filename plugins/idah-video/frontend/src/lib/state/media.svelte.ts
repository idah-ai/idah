// ---------------------------------------------------------------------------
// media.svelte.ts — Reactive media info derived from the global driver
//
// Usage:
//   import { media } from "$lib/state/media.svelte";
//   console.log(media.fps, media.totalFrames);
// ---------------------------------------------------------------------------
import { getDriver } from "$lib/state/driver.svelte";

function readMeta(): Record<string, unknown> {
  return getDriver()?.media?.meta ?? {};
}

export const media = {
  get duration(): number {
    const val = readMeta().duration as number;
    if (val) return val;
    throw new Error("duration not set in metadata — is the driver initialized?");
  },
  get fps(): number {
    const val = readMeta().fps as number;
    if (val) return val;
    throw new Error("fps not set in metadata — is the driver initialized?");
  },
  get width(): number {
    const val = readMeta().width as number;
    if (val) return val;
    throw new Error("width not set in metadata — is the driver initialized?");
  },
  get height(): number {
    const val = readMeta().height as number;
    if (val) return val;
    throw new Error("height not set in metadata — is the driver initialized?");
  },
  get totalFrames(): number {
    return Math.round(this.duration * this.fps);
  },
  get id(): string {
    return getDriver()?.media?.id ?? "";
  },
};
