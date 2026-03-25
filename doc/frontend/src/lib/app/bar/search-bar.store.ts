import { writable } from "svelte/store";

export const searchOpen = writable(false);
export const searchQuery = writable("");
export const searchResults = writable<Array<{
  url: string;
  title: string;
  excerpt: string;
}>>([]);

export function openSearch(): void {
  searchOpen.set(true);
}

export function closeSearch(): void {
  searchOpen.set(false);
  searchQuery.set("");
  searchResults.set([]);
}
