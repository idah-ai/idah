import { writable } from "svelte/store";

import type { INoteFeed } from "@/plugin/interface/Activity";

interface NoteSidebarStore {
  lastUpdated: Date;
  open: boolean;

  noteFeedPopup: {
    show: boolean;
    noteFeed: INoteFeed | null;
  };

  selectedNoteFeed: INoteFeed | null;
  selectedNoteCommentId?: string;
}

export const noteSidebarStore = writable<NoteSidebarStore>({
  lastUpdated: new Date(),
  open: false,

  noteFeedPopup: {
    show: false,
    noteFeed: null,
  },

  selectedNoteFeed: null,
  selectedNoteCommentId: undefined,
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
