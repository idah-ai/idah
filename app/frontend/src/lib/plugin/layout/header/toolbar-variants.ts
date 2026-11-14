// ---------------------------------------------------------------------------
// toolbar-variants.ts — Toolbar item variant helpers for toggle-state styling
//
// Extracted from annotation-header-bar-tools.svelte to keep the template clean.
// ---------------------------------------------------------------------------

import type { IToolbarItem, IToolbarGroupNode } from "@/plugin/v2/types";
import type { ButtonVariant } from "@/components/ui/button/button.svelte";

// ── Leaf item variant ──────────────────────────────────────────────────

/** Resolve the button variant for a toolbar item when toggled. */
export function resolveToggledVariant(item: IToolbarItem): ButtonVariant {
  const v = item.toggledVariant;
  if (v === "success" || v === "destructive") return v;
  return "default";
}

// ── Group button variant ───────────────────────────────────────────────

/** Variant for the collapsed group button — uses the active child's toggledVariant. */
export function groupActiveVariant(node: IToolbarGroupNode, activeLeaf: IToolbarItem | undefined): ButtonVariant {
  if (activeLeaf) {
    const v = activeLeaf.toggledVariant;
    if (v === "success" || v === "destructive") return v;
  }
  return "default";
}

// ── Dropdown item class ────────────────────────────────────────────────

/** CSS class for a toggled dropdown-menu item, based on its toggledVariant. */
export function toggledItemClass(item: IToolbarItem, isToggled: boolean): string {
  if (!isToggled) return "";
  const v = item.toggledVariant;
  if (v === "success") {
    return "bg-green-500 text-white focus:bg-green-500 focus:text-white data-highlighted:bg-green-500 data-highlighted:text-white";
  }
  if (v === "destructive") {
    return "bg-destructive text-white focus:bg-destructive focus:text-white data-highlighted:bg-destructive data-highlighted:text-white";
  }
  return "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground data-highlighted:bg-primary data-highlighted:text-primary-foreground";
}

// ── Group sub-trigger class ────────────────────────────────────────────

/** CSS class for the collapsed group sub-trigger, based on the active leaf's toggledVariant. */
export function groupActiveVariantClass(node: IToolbarGroupNode, activeLeaf: IToolbarItem | undefined): string {
  const v = activeLeaf?.toggledVariant;
  if (v === "success") {
    return "bg-green-500 text-white data-[state=open]:bg-green-500 data-[state=open]:text-white";
  }
  if (v === "destructive") {
    return "bg-destructive text-white data-[state=open]:bg-destructive data-[state=open]:text-white";
  }
  return "bg-primary text-primary-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground";
}
