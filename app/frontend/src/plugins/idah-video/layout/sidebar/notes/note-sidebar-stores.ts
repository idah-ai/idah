import { writable } from "svelte/store";

import type { INoteFeed } from "@/plugin/interface/Activity";

interface NoteSidebarStore {
  lastUpdated: Date;
  open: boolean;

  /** Position and visibility of the comment box */
  noteBox: {
    show: boolean;
    contentMd: string;
    posX: number;
    posY: number;
  };

  /** Selected note feed */
  selectedNoteFeed: INoteFeed | null;
}

export const noteSidebarStore = writable<NoteSidebarStore>({
  lastUpdated: new Date(),
  open: true,

  noteBox: {
    show: false,
    contentMd: "",
    posX: 0,
    posY: 0,
  },

  selectedNoteFeed: null,
});

export function closeNoteSidebar() {
  noteSidebarStore.update((store) => {
    store.open = false;
    store.noteBox = {
      show: false,
      contentMd: "",
      posX: 0,
      posY: 0,
    };
    return store;
  });
}
