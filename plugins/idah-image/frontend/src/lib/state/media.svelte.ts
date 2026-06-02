// ---------------------------------------------------------------------------
// media.svelte.ts — Reactive media info derived from the global driver
//
// Usage:
//   import { media } from "$lib/state/media.svelte";
//   console.log(media.fps, media.totalFrames);
// ---------------------------------------------------------------------------
import { getDriver } from "$lib/state/driver.svelte";

function readMedia() {
  return getDriver()?.media;
}

function readMeta(): Record<string, unknown> {
  return readMedia()?.meta ?? {};
}

const MEDIA_BASE = "/medias/files";

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
  /** Construct the download URL from the media's resource and key, or use an explicit url. */
  get url(): string {
    const m = readMedia();
    if (!m) return "";
    if (m.url) return m.url;
    const path = m.key ? `${m.resource}/${m.key}` : m.resource;
    return `${MEDIA_BASE}/${path}`;
  },
};
