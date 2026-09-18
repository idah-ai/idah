// ---------------------------------------------------------------------------
// V2 Toolbar Manager — items, groups, ordering
// ---------------------------------------------------------------------------
import type { IToolbarGroupNode, IToolbarItem, IToolbarNode, ToolbarItemOptions } from "$idah/v2/types";

export class ToolbarManagerV2 {
  /** All registered items. */
  private items: IToolbarItem[] = [];

  /** Per-mode group ordering. */
  private groupOrders: Map<string, string[]> = new Map();

  /** Revision counter for toggle state invalidation. */
  revision = 0;

  invalidate(): void {
    this.revision++;
  }

  // ── Registration ──────────────────────────────────────────────────────

  add(opts: ToolbarItemOptions): void {
    const modes = Array.isArray(opts.modes) ? opts.modes : [opts.modes];
    for (const mode of modes) {
      this.items.push({
        icon: opts.icon,
        label: opts.label,
        mode,
        group: opts.group,
        onClick: opts.onClick,
        name: opts.name,
        visibleWhen: opts.visibleWhen,
        whenToggled: opts.whenToggled ?? (() => false),
      });
    }
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
    const visible = this.items.filter(
      (it) => it.mode === mode && (it.visibleWhen?.() ?? true),
    );

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

  /**
   * Return the toolbar as a node tree for the given mode. Standalone items (`group == null`)
   * become leaf nodes; items with a colon path are folded into nested group nodes.
   */
  getNodesForMode(mode: string): IToolbarNode[] {
    const items = this.getItemsForMode(mode);
    const roots: IToolbarNode[] = [];
    const groupsByPath = new Map<string, IToolbarGroupNode>();

    for (const item of items) {
      if (!item.group) {
        roots.push({ kind: "item", item });
        continue;
      }

      const segments = item.group.split(":");
      let currentChildren = roots;
      let currentPath = "";

      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}:${segment}` : segment;
        let node = groupsByPath.get(currentPath);
        if (!node) {
          node = { kind: "group", path: currentPath, segment, children: [] };
          groupsByPath.set(currentPath, node);
          currentChildren.push(node);
        }
        currentChildren = node.children;
      }

      currentChildren.push({ kind: "item", item });
    }

    return roots;
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
