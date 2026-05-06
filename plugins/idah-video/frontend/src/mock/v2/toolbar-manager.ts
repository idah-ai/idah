// ---------------------------------------------------------------------------
// V2 Toolbar Manager — items, groups, ordering
// ---------------------------------------------------------------------------
import type { IToolbarItem } from "$mock/v2/types";

export class ToolbarManagerV2 {
  /** All registered items. */
  private items: IToolbarItem[] = [];

  /** Per-mode group ordering. Not set => natural insertion order for groups. */
  private groupOrders: Map<string, string[]> = new Map();

  // ── Registration ──────────────────────────────────────────────────────

  add(
    icon: string,
    mode: string,
    group: string | null,
    onClick: () => void,
    whenActive?: () => boolean,
    whenToggled?: () => boolean,
  ): void {
    this.items.push({
      icon,
      mode,
      group,
      onClick,
      whenActive: whenActive ?? (() => true),
      whenToggled: whenToggled ?? (() => false),
    });
  }

  /** Define group display order for a mode. */
  orderGroups(mode: string, groups: string[]): void {
    this.groupOrders.set(mode, groups);
  }

  // ── Queries ───────────────────────────────────────────────────────────

  /**
   * Return items visible for the given mode, sorted by group order.
   * Items with group = null are always first.
   */
  getItemsForMode(mode: string): IToolbarItem[] {
    // Filter by mode and whenActive
    const visible = this.items.filter((it) => it.mode === mode && it.whenActive());

    // Group ordering
    const order = this.groupOrders.get(mode);

    // Stable sort:
    // 1) null group first
    // 2) by index in order (if provided), then by insertion order
    const orderIndex = new Map<string, number>();
    if (order) {
      order.forEach((g, i) => orderIndex.set(g, i));
    }

    return [...visible].sort((a, b) => {
      // null groups always come first
      if (a.group === null && b.group !== null) return -1;
      if (a.group !== null && b.group === null) return 1;
      if (a.group === null && b.group === null) return 0;

      // Both have non-null groups
      const aIdx = orderIndex.get(a.group!) ?? Infinity;
      const bIdx = orderIndex.get(b.group!) ?? Infinity;
      return aIdx - bIdx;
    });
  }

  /** Get all registered items (for debugging). */
  getAllItems(): IToolbarItem[] {
    return [...this.items];
  }

  /** Remove all items (for cleanup). */
  clear(): void {
    this.items = [];
    this.groupOrders.clear();
  }
}
