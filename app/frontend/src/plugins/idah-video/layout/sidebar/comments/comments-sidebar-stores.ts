import { writable } from "svelte/store";

interface CommentsSidebarStore {
  lastUpdated: Date;
  open: boolean;
  showFilters: boolean;

  /** Position and visibility of the comment box */
  commentBox: {
    show: boolean;
    contentMd: string;
    posX: number;
    posY: number;
  };
}

export const commentsSidebarStore = writable<CommentsSidebarStore>({
  lastUpdated: new Date(),
  open: false,
  showFilters: false,
  commentBox: {
    show: false,
    contentMd: "",
    posX: 0,
    posY: 0,
  },
});

export function closeCommentsSidebar() {
  commentsSidebarStore.update((store) => {
    store.open = false;
    store.commentBox = {
      show: false,
      contentMd: "",
      posX: 0,
      posY: 0,
    };
    return store;
  });
}
