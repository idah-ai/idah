const workspaceTransform = $state({
  translate: [0, 0],
  rotate: 0,
  scale: 1.0
})

const workspaceDimensions = $state([0,0])

const timelineRange = $state({ startRange: 0, endRange: 0 });
const timelineDimensions = $state([0, 0]);

const videoCurrentFrame = $state({ value: 1 })
const videoStatus = $state("pause")

export const viewport = {
  timeline: {
    range: timelineRange,
    dimensions: timelineDimensions
  },
  video: {
    currentFrame: videoCurrentFrame,
    status: videoStatus,
    play() {
      this.status = "play"
    },
    pause() {
      this.status = "pause"
    }
  },
  workspace: {
    transform: workspaceTransform,
    dimensions: workspaceDimensions
  }
}
