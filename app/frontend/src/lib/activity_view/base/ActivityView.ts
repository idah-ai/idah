import type { Component } from "svelte"

export type ActivityView = {
  name: string,
  view: Component,
  defaultMode: string, // e.g. "visual" for video, can move to "createPolygon" etc...
  modes: {
    [key: string]: {
      /* todo */
      name: string
    }
  }
}