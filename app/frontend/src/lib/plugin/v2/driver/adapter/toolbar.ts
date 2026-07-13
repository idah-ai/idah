import type { ToolbarManagerV2 } from "../manager/toolbar-manager.svelte";
import type { IToolbarDriverV2, ToolbarItemOptions } from "../../types";

// ---------------------------------------------------------------------------
// Adapter: toolbar driver → IToolbarDriverV2
// ---------------------------------------------------------------------------
export class ToolbarDriverAdapter implements IToolbarDriverV2 {
  constructor(private mgr: ToolbarManagerV2) {}

  add(options: ToolbarItemOptions): void {
    this.mgr.add(options);
  }

  orderGroups(mode: string, groups: string[]): void {
    this.mgr.orderGroups(mode, groups);
  }

  get revision(): number {
    return this.mgr.revision;
  }

  invalidate(): void {
    this.mgr.invalidate();
  }
}
