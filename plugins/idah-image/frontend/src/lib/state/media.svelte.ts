// ---------------------------------------------------------------------------
// media.svelte.ts — Reactive media info derived from the global driver
//
// Usage:
//   import { media } from "$lib/state/media.svelte";
// ---------------------------------------------------------------------------
import { getDriver } from "$lib/state/driver.svelte";

function readMedia() {
  return getDriver()?.media;
}

function readMeta(): Record<string, unknown> {
  return readMedia()?.meta ?? {};
}

export const media = {
  get dimensions(): number[] {
    return [this.width, this.height];
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
  get id(): string {
    return readMedia()?.id ?? "";
  },
  get format(): string {
    return readMedia()?.mime_type ?? "";
  },
  get url(): string {
    return readMedia()?.url ?? "";
  },
};
