import type { Snippet } from "svelte";
import { writable } from "svelte/store";

export interface ContextMenuComponentProps {
  [key: string]: unknown;
}

export type ContextMenuComponent = Snippet<[ContextMenuComponentProps]> | null;

interface ContextMenuState {
  visible: boolean;
  component: ContextMenuComponent;
  props: ContextMenuComponentProps;
  x: number;
  y: number;
}

export const contextMenuState = writable<ContextMenuState>({
  visible: false,
  component: null,
  props: {},
  x: 0,
  y: 0,
});

export function showContextMenu(
  component: ContextMenuComponent,
  props: ContextMenuComponentProps,
  x: number,
  y: number,
) {
  contextMenuState.set({
    visible: true,
    component,
    props,
    x,
    y,
  });
}

export function hideContextMenu() {
  contextMenuState.set({
    visible: false,
    component: null,
    props: {},
    x: 0,
    y: 0,
  });
}
