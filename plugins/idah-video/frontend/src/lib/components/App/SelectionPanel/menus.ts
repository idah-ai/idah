import { CrosshairIcon, Trash2Icon, type Icon as IconType } from "@lucide/svelte";

import { annotation } from "$lib/state/annotation.svelte";
import { getDriver } from "$lib/state/driver.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";

import type { IVideoAnnotationRecord } from "$lib/types";

export interface AnnotationAction {
  label: string;
  icon: typeof IconType;
  disabled?: boolean;
  onclick: (e: MouseEvent) => void;
}

export function getAnnotationActions(ann: IVideoAnnotationRecord): AnnotationAction[] {
  return [
    {
      label: "Focus Annotation",
      icon: CrosshairIcon,
      onclick: (e: MouseEvent) => {
        e.stopPropagation();
        selection.selectAnnotation(ann);
        getDriver().command.call("timeline.focus");
      },
    },
    ...(isEditable()
      ? [
          {
            label: "Delete Annotation",
            icon: Trash2Icon,
            disabled: annotation.isLocked(ann) || viewport.isReviewWorkspace,
            onclick: (e: MouseEvent) => {
              e.stopPropagation();
              getDriver().command.call("annotation.delete", { annotationId: ann.id });
            },
          },
        ]
      : []),
  ];
}
