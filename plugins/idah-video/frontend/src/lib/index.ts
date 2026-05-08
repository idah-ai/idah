// place files you want to import through the `$lib` alias in this folder.
import { mount, unmount } from "svelte";

import IdahVideoPlugin from "$lib/plugin/idah-video-plugin.svelte";

interface IActivityView {
  name: string;
  label: string;
  description: string;
  version: string;
  type: string;
  init(): void;
  render(parent: HTMLElement): void;
  close(): void;
}

let mounted: object;

const idahVideoPlugin: IActivityView = {
  name: "idah-video",
  label: "IDAH Video Annotation",
  description: "A module for annotating video.",
  version: "1.0.0",
  type: "video",
  init() {
    console.debug("Initializing Plugin", { this: this });
  },

  render(parent: HTMLElement) {
    console.debug("Rendering Plugin", { this: this, parent });

    if (!parent) return console.error("Missing:", { parent });

    parent.innerHTML = "";
    // NOTE: The V2 driver is expected to be set up externally via
    //   initDriver(driver); initDataStores();
    // before render() is called. The IdahVideoPlugin no longer wires them.
    mounted = mount(IdahVideoPlugin, { target: parent });
  },

  close() {
    console.debug("Closing Plugin", { this: this, parent, mounted });
    if (mounted) {
      unmount(mounted);
    }
  },
};

export default idahVideoPlugin;
