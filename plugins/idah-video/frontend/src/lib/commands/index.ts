// ---------------------------------------------------------------------------
// commands/index.ts — Register all commands with the V2 driver
//
// Call this once when the driver is ready (e.g. on component mount).
// ---------------------------------------------------------------------------
import type { IIdahDriverV2, ICommandAction } from "$idah/v2/types";

/** Noop action — returned when pre-conditions fail so the command is not stacked. */
export function noopAction(command: { name: string; modes: string[]; shortcut: string | null; shortDescription: string | null; longDescription: string | null }): ICommandAction {
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
import { register as registerViewportNextFrame } from "./viewport/next-frame";
import { register as registerViewportPreviousFrame } from "./viewport/previous-frame";
import { register as registerViewportSkipForward } from "./viewport/skip-forward";
import { register as registerViewportSkipBackward } from "./viewport/skip-backward";
import { register as registerViewportGoToStart } from "./viewport/go-to-start";
import { register as registerViewportGoToEnd } from "./viewport/go-to-end";
import { register as registerViewportZoomIn } from "./viewport/zoom-in";
import { register as registerViewportZoomOut } from "./viewport/zoom-out";

import { register as registerSelectionDelete } from "./selection/delete";
import { register as registerSelectionGoto } from "./selection/goto";
import { register as registerSelectionCenter } from "./selection/center";

import { register as registerKeyframeAdd } from "./annotation/keyframe_add";
import { register as registerKeyframeDelete } from "./annotation/keyframe_delete";

import { register as registerGroupDelete } from "./group/delete";

import { register as registerNoteAdd } from "./note/add";
import { register as registerNoteGoto } from "./note/goto";

import { register as registerAnnotationAdd } from "./annotation/add";
import { register as registerAnnotationPolygonAddPoint } from "./annotation/polygon.add_point.svelte";
import { register as registerAnnotationUpdate } from "./annotation/update";
import { register as registerAnnotationSplit } from "./annotation/split";
import { register as registerAnnotationGoToNextKeyframe } from "./annotation/go_to_next_keyframe";
import { register as registerAnnotationGoToPrevKeyframe } from "./annotation/go_to_prev_keyframe";

import { register as registerToggleColorMode } from "./display/toggle-color-mode";
import { register as registerToggleRenderMode } from "./display/toggle-render-mode";

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
  registerViewportNextFrame(driver);
  registerViewportPreviousFrame(driver);
  registerViewportSkipForward(driver);
  registerViewportSkipBackward(driver);
  registerViewportGoToStart(driver);
  registerViewportGoToEnd(driver);
  registerViewportZoomIn(driver);
  registerViewportZoomOut(driver);

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
  registerAnnotationAdd(driver);
  registerAnnotationPolygonAddPoint(driver);
  registerAnnotationUpdate(driver);
  registerAnnotationSplit(driver);
  registerAnnotationGoToNextKeyframe(driver);
  registerAnnotationGoToPrevKeyframe(driver);

  // ── UI / Display ─────────────────────────────────────────────────────
  registerToggleColorMode(driver);
  registerToggleRenderMode(driver);
}
