const range = $state({ startRange: 0, endRange: 0 });
const currentFrame = $state({ value: 1 })

export const viewport = {
  timeline: { range }, currentFrame
}
