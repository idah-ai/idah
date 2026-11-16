// ---------------------------------------------------------------------------
// V2 Toolbar Manager — items, groups, ordering (V2 duplicate)
// ---------------------------------------------------------------------------
import { SvelteMap } from "svelte/reactivity";
import type {
  IToolbarGroupNode,
  IToolbarItem,
  IToolbarNode,
  ToolbarGroupOptions,
  ToolbarItemOptions,
} from "../../types";

export class ToolbarManagerV2 {
  /** All registered items. */
  private items: IToolbarItem[] = [];

  /** Per-mode group ordering. */
  private groupOrders: Map<string, string[]> = new SvelteMap();

  /** Group display metadata (title, icon), keyed by full colon path. */
  private groupMeta: Map<string, ToolbarGroupOptions> = new SvelteMap();

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
        toggledVariant: opts.toggledVariant,
        variant: opts.variant,
        separatorBefore: opts.separatorBefore,
        section: opts.section,
      });
    }
  }

  /** Define group display order for a mode. */
  orderGroups(mode: string, groups: string[]): void {
    this.groupOrders.set(mode, groups);
  }

  /** Give a group (by full colon path) a title and an icon for the renderer. */
  defineGroup(path: string, options: ToolbarGroupOptions): void {
    this.groupMeta.set(path, options);
  }

  // ── Queries ───────────────────────────────────────────────────────────

  /** Return the items visible in the given mode, in registration order. */
  getItemsForMode(mode: string): IToolbarItem[] {
    // Filter by mode and visibleWhen ('*' is a wildcard matching any mode)
    return this.items.filter((it) => (it.mode === mode || it.mode === "*") && (it.visibleWhen?.() ?? true));
  }

  /**
   * Rearrange the top-level groups named in `orderGroups(mode, …)` among the slots those
   * groups occupy, leaving every other node where it is.
   */
  private applyGroupOrder(mode: string, roots: IToolbarNode[]): IToolbarNode[] {
    const order = this.groupOrders.get(mode);
    if (!order?.length) return roots;
    const rank = (node: IToolbarNode) => (node.kind === "group" ? order.indexOf(node.path) : -1);
    const slots = roots.map((node, i) => (rank(node) >= 0 ? i : -1)).filter((i) => i >= 0);
    const ordered = slots.map((i) => roots[i]).sort((a, b) => rank(a) - rank(b));
    const out = [...roots];
    slots.forEach((slot, k) => (out[slot] = ordered[k]));
    return out;
  }

  /**
   * Return the toolbar as a node tree for the given mode. Standalone items (`group == null`)
   * become leaf nodes; items with a colon path are folded into nested group nodes. Nodes keep
   * registration order — a group sits where its first item was registered — after mode
   * filtering and `visibleWhen`; `orderGroups` then rearranges the listed top-level groups.
   */
  getNodesForMode(mode: string): IToolbarNode[] {
    const items = this.getItemsForMode(mode);
    const roots: IToolbarNode[] = [];
    // Track group nodes already created, keyed by full colon path, so members of the same
    // group (and its ancestors) reuse the same node instead of creating duplicates.
    const groupsByPath = new SvelteMap<string, IToolbarGroupNode>();

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
          const meta = this.groupMeta.get(currentPath);
          node = {
            kind: "group",
            path: currentPath,
            segment,
            label: meta?.label,
            icon: meta?.icon,
            whenAccented: meta?.whenAccented,
            accentVariant: meta?.accentVariant,
            section: meta?.section ?? item.section,
            children: [],
          };
          groupsByPath.set(currentPath, node);
          currentChildren.push(node);
        }
        currentChildren = node.children;
      }

      currentChildren.push({ kind: "item", item });
    }

    return this.applyGroupOrder(mode, roots);
  }

  /** Get all registered items (for debugging). */
  getAllItems(): IToolbarItem[] {
    return [...this.items];
  }

  /** Remove all items (for cleanup). */
  clear(): void {
    this.items = [];
    this.groupOrders.clear();
    this.groupMeta.clear();
  }
}
