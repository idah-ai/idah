// ---------------------------------------------------------------------------
// commands/index.ts — Register all commands with the V2 driver
//
// Call this once when the driver is ready (e.g. on component mount).
// ---------------------------------------------------------------------------
import type { IIdahDriverV2, ICommandAction } from "$idah/v2/types";

/** Noop action — returned when pre-conditions fail so the command is not stacked. */
export function noopAction(command: { name: string; modes: string[]; shortcut: [string | null, string] | null; shortDescription: string | null; longDescription: string | null }): ICommandAction {
  return {
    command: { ...command },
    do() {},
    isCombinable() { return false; },
    combine(p) { return p; },
  };
}

import { register as registerViewportPlay } from "./viewport/play";
import { register as registerViewportGoto } from "./viewport/goto";
import { register as registerViewportReset } from "./viewport/reset";

import { register as registerSelectionDelete } from "./selection/delete";
import { register as registerSelectionGoto } from "./selection/goto";
import { register as registerSelectionCenter } from "./selection/center";

import { register as registerKeyframeAdd } from "./keyframe/add";
import { register as registerKeyframeDelete } from "./keyframe/delete";

import { register as registerGroupDelete } from "./group/delete";

import { register as registerNoteAdd } from "./note/add";
import { register as registerNoteGoto } from "./note/goto";

import { register as registerAnnotationBoundingBoxAdd } from "./annotation/bounding-box.add";
import { register as registerAnnotationPolygonAdd } from "./annotation/polygon.add";
import { register as registerAnnotationPolygonAddPoint } from "./annotation/polygon.add_point.svelte";

/**
 * Register all commands on the given V2 driver.
 * Safe to call multiple times (the V2 command manager throws on duplicate
 * registration, so consumers should call this only once).
 */
export function registerAllCommands(driver: IIdahDriverV2): void {
  // ── Viewport ─────────────────────────────────────────────────────────
  registerViewportPlay(driver);
  registerViewportGoto(driver);
  registerViewportReset(driver);

  // ── Selection ─────────────────────────────────────────────────────────
  registerSelectionDelete(driver);
  registerSelectionGoto(driver);
  registerSelectionCenter(driver);

  // ── Keyframe ──────────────────────────────────────────────────────────
  registerKeyframeAdd(driver);
  registerKeyframeDelete(driver);

  // ── Group ─────────────────────────────────────────────────────────────
  registerGroupDelete(driver);

  // ── Note ──────────────────────────────────────────────────────────────
  registerNoteAdd(driver);
  registerNoteGoto(driver);

  // ── Annotation ────────────────────────────────────────────────────────
  registerAnnotationBoundingBoxAdd(driver);
  registerAnnotationPolygonAdd(driver);
  registerAnnotationPolygonAddPoint(driver);
}
