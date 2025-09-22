import type { IActivityContext, IActivityView } from "@/plugin/interface/Activity";
import { mount, unmount } from "svelte";
import Plugin from "./plugin.svelte";

let context: IActivityContext | undefined;

let mounted: any;

const idah_player_test: IActivityView = {
  name: "idah-video-player-test",
  label: "video player test",
  description: "video player test plugin",
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
    mounted = mount(Plugin, { target: parent, props: { context } });
  },

  close() {
    console.debug("Closing Plugin", { this: this, context, parent, mounted });
    if (mounted) {
      unmount(mounted);
    }
  },
};

export default idah_player_test;
