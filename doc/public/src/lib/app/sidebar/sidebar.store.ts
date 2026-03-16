import { writable } from "svelte/store";

export const sidebarOpen = writable(false);

export function toggleSidebar(): void {
  sidebarOpen.update((v) => !v);
}

export function closeSidebar(): void {
  sidebarOpen.set(false);
}
