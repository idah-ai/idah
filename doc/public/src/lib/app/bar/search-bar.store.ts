import { writable } from "svelte/store";

export const searchOpen = writable(true);

export function openSearch(): void {
  searchOpen.set(true);
}

export function closeSearch(): void {
  searchOpen.set(false);
}
