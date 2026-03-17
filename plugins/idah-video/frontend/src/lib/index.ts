// place files you want to import through the `$lib` alias in this folder.
import type { IActivityContext, IActivityView } from "$idah/context/ActivityContext";
import { mount, unmount } from "svelte";
import Plugin from "$lib/plugin/plugin.svelte";

let mounted: object;

const idah_plugin: IActivityView = {
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
    mounted = mount(Plugin, { target: parent, props: { context } });
  },

  close() {
    console.debug("Closing Plugin", { this: this, parent, mounted });
    if (mounted) {
      unmount(mounted);
    }
  },
};

export default idah_plugin;