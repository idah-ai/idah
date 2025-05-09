import type { ActivityContext } from "$lib/context/ActivityContext"
import type { Component } from "svelte"

/*
* ActivityView is a component that can be used to play with an activity.
* It can be used to display and interact with an activity type.
*/
export type ActivityView = {
  name: string,
  view: Component,
  defaultMode: string, // e.g. "visual" for video, can move to "createPolygon" etc...

  initialize: (activityContext : ActivityContext) => Component,

  // Register keys modes.
  modes: {
    [key: string]: {
      /* todo */
      name: string
    }
  }
}