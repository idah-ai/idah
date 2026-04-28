import { mount, unmount } from "svelte";

import ImagePlugin from "$lib/plugin/image-plugin.svelte";

import type { IActivityContext, IActivityView } from "$lib/context/context";

let mounted: object;

const idah_plugin: IActivityView = {
  name: "idah-image",
  label: "Idah Image Annotation",
  description: "idah image annotation plugin",
  version: "1.0",
  type: "image",
  init() {
    console.debug("Initializing Plugin", { this: this });
  },

  render(parent: HTMLElement, context: IActivityContext) {
    console.debug("Rendering Plugin", { this: this, context, parent });

    if (!parent || !context) return console.error("Missing:", { parent, context });

    parent.innerHTML = "";
    mounted = mount(ImagePlugin, { target: parent, props: { context } });
  },

  close() {
    console.debug("Closing Plugin", { this: this, parent, mounted });
    if (mounted) {
      unmount(mounted);
    }
  },
};

export default idah_plugin;
