// place files you want to import through the `$lib` alias in this folder.
import { mount, unmount } from "svelte";

import Plugin from "$lib/components/Plugin.svelte";
import { type IIdahDriverV2 } from "$idah/v2/types"
import { initDriver } from "./state/driver.svelte";
import { initDataStores } from "./state/data.svelte";
import { registerAllCommands } from "./commands";
import { initToolbar } from "./toolbar";

interface IPluginDriver {
  name: string;
  label: string;
  description: string;
  version: string;
  type: string;
  init(driver:  IIdahDriverV2): void;
  render(parent: HTMLElement): void;
  close(): void;
}

let mounted: object;

const idahVideoPlugin: IPluginDriver = {
  name: "idah-video",
  label: "IDAH Video Annotation",
  description: "A module for annotating video.",
  version: "1.0.0",
  type: "video",
  init(driver: IIdahDriverV2) {
    console.debug("Initializing plugin", { this: this });
    initDriver(driver);
    initDataStores();
    registerAllCommands(driver);
    initToolbar(driver);
    console.debug("Plugin initialized", { this: this, driver });
  },

  render(parent: HTMLElement) {
    console.debug("Rendering Plugin", { this: this, parent });

    if (!parent) return console.error("Missing:", { parent });

    parent.innerHTML = "";
    // NOTE: The V2 driver is expected to be set up externally via
    //   initDriver(driver); initDataStores();
    // before render() is called. The IdahVideoPlugin no longer wires them.
    mounted = mount(Plugin, { target: parent });
  },

  close() {
    console.debug("Closing Plugin", { this: this, parent, mounted });
    if (mounted) {
      unmount(mounted);
    }
  },
};

export default idahVideoPlugin;
