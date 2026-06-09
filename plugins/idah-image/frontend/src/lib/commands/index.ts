// ---------------------------------------------------------------------------
// commands/index.ts — Register all commands with the V2 driver
//
// Call this once when the driver is ready (e.g. on component mount).
// ---------------------------------------------------------------------------
import type { ICommandAction, IIdahDriverV2 } from "$idah/v2/types";

/** Noop action — returned when pre-conditions fail so the command is not stacked. */
export function noopAction(command: {
  name: string;
  modes: string[];
  shortcut: string | null;
  shortDescription: string | null;
  longDescription: string | null;
}): ICommandAction {
  return {
    command: { ...command },
    do() {},
    isCombinable() {
      return false;
    },
    combine(p) {
      return p;
    },
  };
}

import { register as registerViewportReset } from "./viewport/reset";
import { register as registerViewportZoomIn } from "./viewport/zoom-in";
import { register as registerViewportZoomOut } from "./viewport/zoom-out";

import { register as registerSelectionCenter } from "./selection/center";
import { register as registerSelectionDelete } from "./selection/delete";
import { register as registerSelectionGoto } from "./selection/goto";

import { register as registerGroupDelete } from "./group/delete";
import { register as registerGroupToggleEditability } from "./group/toggle_editability";
import { register as registerGroupToggleVisibility } from "./group/toggle_visibility";

import { register as registerNoteAdd } from "./note/add";
import { register as registerNoteGoto } from "./note/goto";

import { register as registerAnnotationAdd } from "./annotation/add";
import { register as registerAnnotationDelete } from "./annotation/delete";
import { register as registerAnnotationDeleteAll } from "./annotation/delete_all";
import { register as registerAnnotationKeyframeAdd } from "./annotation/keyframe_add";
import { register as registerAnnotationKeyframeDelete } from "./annotation/keyframe_delete";
import { register as registerAnnotationPolygonAddPoint } from "./annotation/polygon.add_point.svelte";
import { register as registerAnnotationToggleEditabilityAll } from "./annotation/toggle_editability_all";
import { register as registerAnnotationToggleVisibilityAll } from "./annotation/toggle_visibility_all";
import { register as registerAnnotationUpdate } from "./annotation/update";

import { register as registerToggleColorMode } from "./display/toggle-color-mode";
import { register as registerToggleDebugConsole } from "./display/toggle-debug-console";
import { register as registerToggleRenderMode } from "./display/toggle-render-mode";

import { register as registerCategoryDelete } from "./category/delete";
import { register as registerCategoryToggleEditability } from "./category/toggle_editability";
import { register as registerCategoryToggleVisibility } from "./category/toggle_visibility";

import { register as registerModeBoundingBox } from "./mode/bounding_box";
import { register as registerModeNote } from "./mode/note";
import { register as registerModePolygon } from "./mode/polygon";
import { register as registerModeSelect } from "./mode/select";

/**
 * Register all commands on the given V2 driver.
 * Safe to call multiple times (the V2 command manager throws on duplicate
 * registration, so consumers should call this only once).
 */
export function registerAllCommands(driver: IIdahDriverV2): void {
  // ── Viewport ─────────────────────────────────────────────────────────
  registerViewportReset(driver);
  registerViewportZoomIn(driver);
  registerViewportZoomOut(driver);

  // ── Selection ─────────────────────────────────────────────────────────
  registerSelectionDelete(driver);
  registerSelectionGoto(driver);
  registerSelectionCenter(driver);

  // ── Group ─────────────────────────────────────────────────────────────
  registerGroupDelete(driver);
  registerGroupToggleVisibility(driver);
  registerGroupToggleEditability(driver);

  // ── Note ──────────────────────────────────────────────────────────────
  registerNoteAdd(driver);
  registerNoteGoto(driver);

  // ── Annotation ────────────────────────────────────────────────────────
  registerAnnotationAdd(driver);
  registerAnnotationDelete(driver);
  registerAnnotationDeleteAll(driver);
  registerAnnotationToggleVisibilityAll(driver);
  registerAnnotationToggleEditabilityAll(driver);
  registerAnnotationPolygonAddPoint(driver);
  registerAnnotationUpdate(driver);
  registerAnnotationKeyframeAdd(driver);
  registerAnnotationKeyframeDelete(driver);

  registerCategoryToggleEditability(driver);
  registerCategoryToggleVisibility(driver);
  registerCategoryDelete(driver);

  // ── Mode ──────────────────────────────────────────────────────
  registerModeSelect(driver);
  registerModeBoundingBox(driver);
  registerModePolygon(driver);
  registerModeNote(driver);

  // ── UI / Display ─────────────────────────────────────────────────────
  registerToggleColorMode(driver);
  registerToggleDebugConsole(driver);
  registerToggleRenderMode(driver);
}
