// ---------------------------------------------------------------------------
// toolbar-variants.ts — Toolbar item variant helpers for toggle-state styling
//
// Extracted from annotation-header-bar-tools.svelte to keep the template clean.
//
// Toggled items fill solid, like the other tools: green for `toggledVariant:
// "success"`, red for "destructive", the primary colour otherwise.
// ---------------------------------------------------------------------------

import type { IToolbarItem, ToolbarText } from "@/plugin/v2/types";
import type { ButtonVariant } from "@/components/ui/button/button.svelte";

type Tone = "success" | "destructive";

function toneOf(item: IToolbarItem | undefined): Tone | undefined {
  const v = item?.toggledVariant;
  return v === "success" || v === "destructive" ? v : undefined;
}

/** Solid fill per tone for dropdown items, covering their focus / keyboard-highlight states. */
const TONE_ITEM: Record<Tone, string> = {
  success:
    "bg-green-500 text-white focus:bg-green-500 focus:text-white data-highlighted:bg-green-500 data-highlighted:text-white",
  destructive:
    "bg-destructive text-white focus:bg-destructive focus:text-white data-highlighted:bg-destructive data-highlighted:text-white",
};

/** Same fill for a group's sub-trigger, including while its submenu is open. */
const TONE_SUBTRIGGER: Record<Tone, string> = {
  success: "bg-green-500 text-white data-[state=open]:bg-green-500 data-[state=open]:text-white",
  destructive: "bg-destructive text-white data-[state=open]:bg-destructive data-[state=open]:text-white",
};

/**
 * Light tint for a group accent (`whenAccented`): shown while nothing in the group is
 * toggled, so it reads as "has data" rather than "tool on".
 */
const ACCENT_BUTTON: Record<Tone, string> = {
  success:
    "bg-green-500/15 text-green-700 hover:bg-green-500/25 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-500/25 dark:hover:text-green-400",
  destructive:
    "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive dark:hover:bg-destructive/20",
};

const ACCENT_SUBTRIGGER: Record<Tone, string> = {
  success:
    "bg-green-500/15 text-green-700 data-[state=open]:bg-green-500/25 data-[state=open]:text-green-700 dark:text-green-400 dark:data-[state=open]:text-green-400",
  destructive:
    "bg-destructive/10 text-destructive data-[state=open]:bg-destructive/20 data-[state=open]:text-destructive",
};

/** Class for an accented, untoggled group button (rendered with the ghost variant). */
export function accentButtonClass(variant: Tone | undefined): string {
  return ACCENT_BUTTON[variant ?? "success"];
}

/** Class for an accented, untoggled nested group's sub-trigger. */
export function accentSubTriggerClass(variant: Tone | undefined): string {
  return ACCENT_SUBTRIGGER[variant ?? "success"];
}

// ── Header-bar buttons ─────────────────────────────────────────────────

/**
 * Button variant for a toggled item — the item itself for a leaf button, or the group's
 * active child for a collapsed group button.
 */
export function toggledButtonVariant(item: IToolbarItem | undefined): ButtonVariant {
  return toneOf(item) ?? "default";
}

// ── Dynamic text ───────────────────────────────────────────────────────

/** Read a toolbar icon or label — call it when it is a function of plugin state. */
export function resolveToolbarText(value: ToolbarText): string {
  return typeof value === "function" ? value() : value;
}

// ── Dropdown item class ────────────────────────────────────────────────

/**
 * CSS class for a dropdown-menu item: the toggled colours (by `toggledVariant`) while it is
 * toggled, otherwise destructive text for `variant: "destructive"` items.
 */
export function itemClass(item: IToolbarItem, isToggled: boolean): string {
  if (!isToggled) {
    return item.variant === "destructive"
      ? "text-destructive focus:text-destructive data-highlighted:text-destructive"
      : "";
  }
  const tone = toneOf(item);
  if (tone) return TONE_ITEM[tone];
  return "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground data-highlighted:bg-primary data-highlighted:text-primary-foreground";
}

// ── Group sub-trigger class ────────────────────────────────────────────

/** CSS class for a nested group's sub-trigger, based on its active child's toggledVariant. */
export function groupActiveVariantClass(activeLeaf: IToolbarItem): string {
  const tone = toneOf(activeLeaf);
  if (tone) return TONE_SUBTRIGGER[tone];
  return "bg-primary text-primary-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground";
}
