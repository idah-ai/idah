// ---------------------------------------------------------------------------
// tool-panel.svelte.ts — Injection state for the floating tool panel
//
// A tool declares its configuration UI by calling `toolPanel.show(Component)`
// when it becomes active, and `toolPanel.hide()` on deselect. The shell
// (FloatingToolPanel) owns all chrome — grip, drag, position, persistence —
// and simply renders whatever component is injected here.
// ---------------------------------------------------------------------------
import type { Component } from "svelte";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _component = $state<Component<any> | undefined>(undefined);
let _props = $state<Record<string, unknown>>({});
let _open = $state(false);

export const toolPanel = {
  get component() {
    return _component;
  },
  get props() {
    return _props;
  },
  get open() {
    return _open;
  },
  set open(v: boolean) {
    _open = v;
  },

  /** Inject a config component and open the panel. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  show(component: Component<any>, props: Record<string, unknown> = {}): void {
    _component = component;
    _props = props;
    _open = true;
  },

  /** Clear the injected component and close the panel. */
  hide(): void {
    _component = undefined;
    _props = {};
    _open = false;
  },
};
