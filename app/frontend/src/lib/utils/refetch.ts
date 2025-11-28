import { writable } from "svelte/store";

interface Refetch {
  list: Date;
  get: Date;
}

export interface Refetches {
  /** IAM */
  accounts: Refetch;

  /** DATASET */
  projects: Refetch;
  projectMembers: Refetch;
  datasets: Refetch;
  entries: Refetch;
  noteFeeds: Refetch;
  noteComments: Refetch;

  /** SETTING */
  accountSettings: Refetch;
}

export type RefetchesKey = keyof Refetches;

export const refetches = writable<Refetches>({
  /** IAM */
  accounts: {
    list: new Date(),
    get: new Date(),
  },

  /** DATASET */
  projects: {
    list: new Date(),
    get: new Date(),
  },
  projectMembers: {
    list: new Date(),
    get: new Date(),
  },
  datasets: {
    list: new Date(),
    get: new Date(),
  },
  entries: {
    list: new Date(),
    get: new Date(),
  },
  noteFeeds: {
    list: new Date(),
    get: new Date(),
  },
  noteComments: {
    list: new Date(),
    get: new Date(),
  },

  /** SETTING */
  accountSettings: {
    list: new Date(),
    get: new Date(),
  },
});
