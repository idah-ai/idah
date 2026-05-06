export const viewport = $state({
  timeline: {
    range: { startRange: 0, endRange: 0 },
    dimensions: [0, 0] as [number, number],
  },
  video: {
    currentFrame: { value: 1 },
    status: "pause" as "play" | "pause",
    sound: { level: 0.0, muted: true },
    play() {
      this.status = "play";
    },
    pause() {
      this.status = "pause";
    },
  },
  workspace: {
    transform: {
      translate: [0, 0] as [number, number],
      rotate: 0,
      scale: 1.0,
    },
    dimensions: [0, 0] as [number, number],

    /** Convert a screen-space coordinate to scene (un-transformed) space. */
    screenToScene(sx: number, sy: number): { x: number; y: number } {
      const t = this.transform;
      return {
        x: (sx - t.translate[0]) / t.scale,
        y: (sy - t.translate[1]) / t.scale,
      };
    },

    /** Convert a scene (un-transformed) coordinate to screen space. */
    sceneToScreen(x: number, y: number): { x: number; y: number } {
      const t = this.transform;
      return {
        x: x * t.scale + t.translate[0],
        y: y * t.scale + t.translate[1],
      };
    },
  },
});
