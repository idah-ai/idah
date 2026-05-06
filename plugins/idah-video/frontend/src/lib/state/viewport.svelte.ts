export const viewport = $state({
  timeline: {
    range: { startRange: 0, endRange: 0 },
    dimensions: [0, 0] as [number, number],
  },
  video: {
    currentFrame: { value: 1 },
    status: "pause" as "play" | "pause",
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
  },
});
