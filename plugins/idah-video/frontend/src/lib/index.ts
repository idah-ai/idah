// place files you want to import through the `$lib` alias in this folder.
import { mount, unmount } from "svelte";

import IdahVideoPlugin from "$lib/plugin/idah-video-plugin.svelte";

import type { IActivityContext, IActivityView } from "$idah/context/activity-context";

let mounted: object;

const idahVideoPlugin: IActivityView = {
  name: "idah-video",
  label: "IDAH Video Annotation",
  description: "A module for annotating video.",
  version: "1.0.0",
  type: "image",
  init() {
    console.debug("Initializing Plugin", { this: this });
  },

  render(parent: HTMLElement, context: IActivityContext) {
    console.debug("Rendering Plugin", { this: this, context, parent });

    if (!parent || !context) return console.error("Missing:", { parent, context });

    parent.innerHTML = "";
    // NOTE: The V2 driver is expected to be set up externally via
    //   initDriver(driver); initDataStores();
    // before render() is called. The IdahVideoPlugin no longer wires them.
    mounted = mount(IdahVideoPlugin, { target: parent, props: { context } });
  },

  close() {
    console.debug("Closing Plugin", { this: this, parent, mounted });
    if (mounted) {
      unmount(mounted);
    }
  },
};

export default idahVideoPlugin;
