import { getDriver } from "./driver.svelte";
import { media } from "./media.svelte";

class Viewport {
  // Only mode needs special handling
  #mode = $state("default");

  get mode() { return this.#mode; }
  set mode(val: string) {
    if (this.#mode === val) return;
    this.#mode = val;
    getDriver().setMode(val);
  }

  timeline = $state({
    range: { startRange: 0, endRange: 0 },
    dimensions: [0, 0] as [number, number],
  });

  video = $state({
    currentFrame: { value: 0 },
    status: "pause" as "play" | "pause",
    sound: { level: 0.0, muted: true },
    play() { this.status = "play"; },
    pause() { this.status = "pause"; },
  });

  workspace = $state({
    transform: {
      translate: [0, 0] as [number, number],
      scale: 1.0,
    },
    dimensions: [0, 0] as [number, number],
    screenToScene(sx: number, sy: number) {
      const t = this.transform;
      return { x: (sx - t.translate[0]) / t.scale, y: (sy - t.translate[1]) / t.scale };
    },
    sceneToScreen(x: number, y: number) {
      const t = this.transform;
      return { x: x * t.scale + t.translate[0], y: y * t.scale + t.translate[1] };
    },
    get viewportSize(): number[] {
      const t = this.transform;
      const d = this.dimensions;
      const m = media.dimensions;
      const s = t.scale

      return [
        -t.translate[0] / (s * m[0]),
        -t.translate[1] / (s * m[1]),
        (-t.translate[0] + d[0]) / (s * m[0]),
        (-t.translate[1] + d[1]) / (s * m[1])
      ]
    }
  });
}

export const viewport = new Viewport();
