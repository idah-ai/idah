import { writable } from "svelte/store";

interface Refetch {
  list: number;
  get: number;
}

interface Refetches {
  /** IAM */
  accounts: Refetch;

  /** DATASET */
  projects: Refetch;
  projectMembers: Refetch;
}

export const refetches = writable<Refetches>({
  /** IAM */
  accounts: {
    list: 0,
    get: 0,
  },

  /** DATASET */
  projects: {
    list: 0,
    get: 0,
  },
  projectMembers: {
    list: 0,
    get: 0,
  },
});
