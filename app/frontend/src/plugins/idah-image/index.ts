import type { IActivityContext, IActivityView } from "@/plugin/interface/Activity";
import { mount, unmount } from "svelte";
import Plugin from "./plugin.svelte";

let mounted: object;

const idah_plugin: IActivityView = {
  name: "idah-image",
  label: "idah image",
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
