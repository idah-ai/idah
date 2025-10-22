import { writable } from "svelte/store";

import type { INoteFeed } from "@/plugin/interface/Activity";

interface NoteSidebarStore {
  lastUpdated: Date;
  open: boolean;

  noteFeedPopup: {
    show: boolean;
    noteFeed: INoteFeed | null;
  };

  /** Selected note feed */
  selectedNoteFeed: INoteFeed | null;
}

export const noteSidebarStore = writable<NoteSidebarStore>({
  lastUpdated: new Date(),
  open: true,

  noteFeedPopup: {
    show: false,
    noteFeed: null,
  },

  selectedNoteFeed: null,
});

export function closeNoteFeedPopup() {
  noteSidebarStore.update((store) => {
    store.noteFeedPopup = {
      show: false,
      noteFeed: null,
    };
    return store;
  });
}

export function closeNoteSidebar() {
  noteSidebarStore.update((store) => {
    store.open = false;

    closeNoteFeedPopup();

    return store;
  });
}
