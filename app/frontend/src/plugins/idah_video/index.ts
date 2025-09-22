import type { IActivityContext, IActivityView } from "@/plugin/interface/Activity";
import VideoPlugin from "./VideoPlugin.svelte";
import { mount, unmount } from "svelte";

let context: IActivityContext | undefined;

let mounted: any;

const idah_video: IActivityView = {
  name: "idah-video",
  label: "idah video annotation plugin",
  description: "idah video annotation plugin",
  version: "1.0",
  type: "video",

  init(_context: IActivityContext) {
    context = _context;
    console.debug("Initializing Plugin", { this: this, context });
  },

  render(parent: HTMLElement) {
    console.debug("Rendering Plugin", { this: this, context, parent });

    if (!parent || !context) return console.error("Missing:", { parent, context });

    parent.innerHTML = "";
    mounted = mount(VideoPlugin, { target: parent, props: { context } });

    console.debug({ mounted });
  },

  close() {
    console.debug("Closing Plugin", { this: this, context, parent, mounted });
    if (mounted) {
      unmount(mounted);
    }
  },
};

export default idah_video;
