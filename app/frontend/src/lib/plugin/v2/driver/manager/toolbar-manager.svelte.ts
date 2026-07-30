// ---------------------------------------------------------------------------
// V2 Toolbar Manager — items, groups, ordering (V2 duplicate)
// ---------------------------------------------------------------------------
import { SvelteMap } from "svelte/reactivity";
import type { IToolbarGroupNode, IToolbarItem, IToolbarNode, ToolbarItemOptions } from "../../types";

export class ToolbarManagerV2 {
  /** All registered items. */
  private items: IToolbarItem[] = [];

  /** Per-mode group ordering. */
  private groupOrders: Map<string, string[]> = new SvelteMap();

  /**
   * Monotonically increasing counter. Incremented when a toolbar item's
   * toggle state (whenToggled) may have changed. The header bar reads
   * this inside its toggledMap derived to force re-evaluation.
   */
  revision = $state(0);

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
    // Filter by mode and whenActive ('*' is a wildcard matching any mode)
    const visible = this.items.filter((it) => (it.mode === mode || it.mode === "*") && (it.visibleWhen?.() ?? true));

    // Group ordering
    const order = this.groupOrders.get(mode);

    // Stable sort:
    // 1) null group first
    // 2) by index in order (if provided), then by insertion order
    const orderIndex = new SvelteMap<string, number>();
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
   * become leaf nodes; items with a colon path are folded into nested group nodes. Built on
   * top of `getItemsForMode`, so mode filtering, `visibleWhen`, and `orderGroups` all apply
   * identically — in particular null-group items come first, then grouped items, so a group
   * renders after the standalone tools.
   */
  getNodesForMode(mode: string): IToolbarNode[] {
    const items = this.getItemsForMode(mode);
    const roots: IToolbarNode[] = [];
    // Track group nodes already created, keyed by full colon path, so members of the same
    // group (and its ancestors) reuse the same node instead of creating duplicates.
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
