import { writable } from "svelte/store";

interface Refetch {
  list: number;
  get: number;
}

interface Refetches {
  projects: Refetch;
  projectMembers: Refetch;
}

export const refetches = writable<Refetches>({
  projects: {
    list: 0,
    get: 0,
  },
  projectMembers: {
    list: 0,
    get: 0,
  },
});
