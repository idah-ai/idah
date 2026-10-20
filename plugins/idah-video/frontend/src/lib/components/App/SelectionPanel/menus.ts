import { CrosshairIcon, Trash2Icon, type Icon as IconType } from "@lucide/svelte";

import { annotation } from "$lib/state/annotation.svelte";
import { getDriver } from "$lib/state/driver.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { showConfirmDeleteAnnotationsDialog } from "$lib/components/App/ConfirmDialog/confirm-delete";

import { VIDEO_FRAME, ENTRY_ROOT, type IVideoAnnotationRecord } from "$lib/types";
import { humanize } from "$lib/utils/string";

export interface AnnotationAction {
  label: string;
  icon: typeof IconType;
  disabled?: boolean;
  onclick: (e: MouseEvent) => void;
}

export function getAnnotationActions(ann: IVideoAnnotationRecord, annDisplayName: string | undefined): AnnotationAction[] {
  return [
    {
      label: "Focus Annotation",
      icon: CrosshairIcon,
      onclick: (e: MouseEvent) => {
        e.stopPropagation();
        selection.selectAnnotation(ann);
        getDriver().command.call("idah-video:timeline.focus");
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
              const isTag = ann.shape_type === VIDEO_FRAME || ann.shape_type === ENTRY_ROOT;
              showConfirmDeleteAnnotationsDialog({
                count: 1,
                title: "Delete Annotation",
                type: isTag ? "tag" : "annotation",
                shape: ann.shape_type === ENTRY_ROOT ? "Video" : humanize(ann.shape_type.split(":")[1]),
                annotation_category: annDisplayName,
                onConfirm: () => {
                  getDriver().command.call("idah-video:annotation.delete", { annotationId: ann.id });
                },
              });
            },
          },
        ]
      : []),
  ];
}
