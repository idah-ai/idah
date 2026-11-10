import type { Component } from "svelte";

/**
 * Global sheet service.
 *
 * One `<AppSheet />` renders from the root layout; callers open a sheet through
 * {@link openSheet} with the component to show inside, and never hold sheet state themselves.
 *
 * Two kinds:
 * - `modal` (default): a shadcn Sheet, with an overlay and focus trap, for a focused task.
 * - `panel`: a non-modal side panel for reading while working (help, reference). It pushes
 *   the page aside on wide screens and stays usable beside an open modal. One panel shows
 *   at a time: the latest opened.
 */

export type SheetKind = "modal" | "panel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each sheet brings its own props
export interface SheetRequest<Props extends Record<string, any> = Record<string, any>> {
  id: string; // opening an id that is already open replaces it in place
  title: string;
  description?: string;
  component: Component<Props>;
  props?: Props;
  kind?: SheetKind;
  side?: "left" | "right"; // modal sheets only; panels sit on the right
  class?: string; // e.g. a width for the sheet's content
}

class SheetStore {
  /** Open sheets, oldest first. */
  stack = $state<SheetRequest[]>([]);

  get modals(): SheetRequest[] {
    return this.stack.filter((sheet) => (sheet.kind ?? "modal") === "modal");
  }

  /** The panel on screen: the latest opened, if any. */
  get panel(): SheetRequest | undefined {
    return this.stack.findLast((sheet) => sheet.kind === "panel");
  }

  get panelOpen(): boolean {
    return this.panel !== undefined;
  }
}

export const sheetStore = new SheetStore();

// Typed per call, so `props` must match `component`; stored loosely, since the stack mixes sheets.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see SheetRequest
export function openSheet<Props extends Record<string, any>>(request: SheetRequest<Props>): void {
  const sheet = request as unknown as SheetRequest;
  const index = sheetStore.stack.findIndex((open) => open.id === sheet.id);
  if (index === -1) sheetStore.stack.push(sheet);
  else sheetStore.stack[index] = sheet;
}

export function closeSheet(id: string): void {
  sheetStore.stack = sheetStore.stack.filter((sheet) => sheet.id !== id);
}

export function closeAllSheets(): void {
  sheetStore.stack = [];
}

export function getSheet(id: string): SheetRequest | undefined {
  return sheetStore.stack.find((sheet) => sheet.id === id);
}
