import { get } from "svelte/store";
import { uuidv7 } from "uuidv7";

import { showToast } from "$lib/components/ui/toast/index.svelte";
import {
  type ImageAnnotationObject,
  type ImageFrameSelection,
  type ImageShape,
} from "$lib/context/image-annotation-context";
import { entryRoot, setEntryRoot, setIndexedDBUpdatedAt } from "$lib/plugin/store/idb-store.svelte";
import {
  deselectAnnotation,
  deselectAnnotationGroup,
  selectedAnnotation,
  setCurrentModeTo,
  setSelectedAnnotation,
} from "$lib/plugin/store/store";
import { uiStore } from "$lib/plugin/store/ui-store.svelte";
import {
  DEFAULT_MODE,
  ENTRY_ROOT,
  IMAGE_BOUNDING_BOX,
  IMAGE_NOTE,
  IMAGE_POLYGON,
  IMAGE_VISUAL,
} from "$lib/plugin/types";
import { showErrorToast } from "$lib/utils/error/error.toasts";

import type { AnnotationValue } from "$lib/context/annotation-context";
import type { IActivityContext } from "$lib/context/context";
import type { AnnotationBackend } from "$lib/plugin/data/annotation/annotaiton-backend.svelte";

interface CommandContext {
  context: IActivityContext;
  getDb: () => AnnotationBackend | undefined;
  updaters: {
    setAnnotationValue: (value: AnnotationValue) => void;
    selectAnnotation: (annotation?: ImageAnnotationObject) => void;
  };
}

export function registerCommands(params: CommandContext) {
  const { context, getDb, updaters } = params;

  /** HELPER FUNCTIONS */
  async function createAnnotationIndexedDB(props: { annotationToCreate: ImageAnnotationObject }) {
    const { annotationToCreate } = props;
    const db = getDb();

    updaters.selectAnnotation(annotationToCreate);
    await db?.upsertAnnotations([annotationToCreate]);
    entryRoot.set(annotationToCreate.shape.type == ENTRY_ROOT ? annotationToCreate : undefined);
  }

  async function updateAnnotationIndexedDB(props: { annotationToUpdate: ImageAnnotationObject }) {
    const { annotationToUpdate } = props;
    const db = getDb();

    await db?.upsertAnnotations([annotationToUpdate]);
    updaters.selectAnnotation(annotationToUpdate);
    if (get(entryRoot)?.metadata.id == annotationToUpdate.metadata.id) setEntryRoot(annotationToUpdate);
    setIndexedDBUpdatedAt();
  }

  async function syncCreatedAnnotation(props: {
    annotationId: string;
    annotationToCreate: ImageAnnotationObject;
    setSelected?: boolean;
  }) {
    const { annotationId, annotationToCreate, setSelected = true } = props;
    const db = getDb();

    await context.annotations
      .create(annotationId, annotationToCreate.shape, annotationToCreate.value)
      .then(async () => {
        const createdAnnotation = await db?.get("annotations", annotationId);

        if (
          createdAnnotation &&
          createdAnnotation.metadata.updatedAt.valueOf() == createdAnnotation.metadata.createdAt.valueOf()
        ) {
          createdAnnotation.synced = true;
          await db?.upsertAnnotations([createdAnnotation]);
          setEntryRoot(createdAnnotation.shape.type == ENTRY_ROOT ? createdAnnotation : undefined);
          if (setSelected) updaters.selectAnnotation(createdAnnotation);
        }
      });
  }

  async function syncUpdatedAnnotation(props: {
    annotationId: string;
    annotationToUpdate: ImageAnnotationObject;
    value: AnnotationValue;
    updatedAt: Date;
    setSelected?: boolean;
  }) {
    const { annotationId, annotationToUpdate, value, updatedAt, setSelected = true } = props;
    const db = getDb();

    await context.annotations
      .update({
        id: annotationToUpdate.metadata.id,
        dimensions: annotationToUpdate.shape,
        annotation: value,
      })
      .then(async () => {
        const updatedAnnotation = await db?.get("annotations", annotationId);
        if (updatedAnnotation && updatedAnnotation.metadata.updatedAt.valueOf() == updatedAt.valueOf()) {
          updatedAnnotation.synced = true;
          await db?.upsertAnnotations([updatedAnnotation]);

          if (get(entryRoot)?.metadata.id == updatedAnnotation.metadata.id) setEntryRoot(updatedAnnotation);

          updaters.setAnnotationValue(value);
          if (setSelected) updaters.selectAnnotation(updatedAnnotation);
          setIndexedDBUpdatedAt();
        }
      });
  }

  async function deleteAnnotationIndexedDB(annotationId: string) {
    const db = getDb();
    /** deselect annotation if annotation is selected */
    if (get(selectedAnnotation)?.metadata.id == annotationId) deselectAnnotation();
    /** deselect entry root annotation */
    if (get(entryRoot)?.metadata.id == annotationId) entryRoot.set(undefined);

    await db?.deleteAnnotation(annotationId);
    await context.annotations.delete(annotationId);
  }

  function setVisibility(hidden: boolean, annotation?: ImageAnnotationObject) {
    const db = getDb();

    if (annotation) {
      annotation.hidden = hidden;
      if (annotation.metadata.id == get(selectedAnnotation)?.metadata.id) {
        const current = get(selectedAnnotation);
        if (current) selectedAnnotation.set({ ...current, hidden });
      }
      if (annotation.shape.type == ENTRY_ROOT) entryRoot.set(annotation);

      db?.upsertAnnotations([annotation]).then(() => setIndexedDBUpdatedAt());
    } else {
      const currentSelected = get(selectedAnnotation);
      if (currentSelected) selectedAnnotation.set({ ...currentSelected, hidden });
      db?.updateAllVisibility(hidden).then(() => setIndexedDBUpdatedAt());
    }
  }

  function setEditability(locked: boolean, annotation?: ImageAnnotationObject) {
    const db = getDb();

    if (annotation) {
      annotation.locked = locked;
      if (annotation.metadata.id == get(selectedAnnotation)?.metadata.id) {
        const current = get(selectedAnnotation);
        if (current) selectedAnnotation.set({ ...current, locked });
      }
      if (annotation.shape.type == ENTRY_ROOT) entryRoot.set(annotation);
      db?.upsertAnnotations([annotation]).then(() => setIndexedDBUpdatedAt());
    } else {
      if (get(entryRoot)) {
        const root = get(entryRoot);
        if (root) entryRoot.set({ ...root, locked });
      }
      const currentSelected = get(selectedAnnotation);
      if (currentSelected) selectedAnnotation.set({ ...currentSelected, locked });
      db?.updateAllLock(locked).then(() => setIndexedDBUpdatedAt());
    }
  }

  /** COMMAND REGISTRATIONS */
  /** TOOLS/MODE COMMANDS */
  context.commands.on("tools.reset", () => {
    return {
      name: "reset tool",
      apply: () => {
        setCurrentModeTo(DEFAULT_MODE);
        deselectAnnotation();
        deselectAnnotationGroup();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("tools.visual", () => {
    return {
      name: "visual tool",
      apply: () => {
        setCurrentModeTo(IMAGE_VISUAL);
        deselectAnnotation();
        deselectAnnotationGroup();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("tools.bounding_box", () => {
    return {
      name: "bounding box tool",
      apply: () => {
        setCurrentModeTo(IMAGE_BOUNDING_BOX);
        deselectAnnotation();
        deselectAnnotationGroup();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("tools.note", () => {
    return {
      name: "note tool",
      apply: () => {
        setCurrentModeTo(IMAGE_NOTE);
        deselectAnnotation();
        deselectAnnotationGroup();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("tools.polygon", () => {
    return {
      name: "polygon tool",
      apply: () => {
        setCurrentModeTo(IMAGE_POLYGON);
        deselectAnnotation();
        deselectAnnotationGroup();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  /** ANNOTATION COMMANDS */
  context.commands.on("annotation.add", (props: { shape: ImageShape; value: AnnotationValue }) => {
    const { shape, value } = props;
    const uuid = uuidv7();

    return {
      name: "new annotation",
      async apply() {
        const applyCreatedAt = new Date();
        const annotationToCreate: ImageAnnotationObject = {
          shape: shape,
          value: value,
          metadata: {
            id: uuid,
            createdAt: applyCreatedAt,
            updatedAt: applyCreatedAt,
          },
          synced: false,
          locked: false,
          hidden: false,
        };

        await createAnnotationIndexedDB({ annotationToCreate });
        await syncCreatedAnnotation({
          annotationId: uuid,
          annotationToCreate,
        });
        setIndexedDBUpdatedAt();
      },
      async undo() {
        await deleteAnnotationIndexedDB(uuid);
        setIndexedDBUpdatedAt();
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.update", (props: { annotation: ImageAnnotationObject; value: AnnotationValue }) => {
    const { annotation, value } = props;
    const annotationId = annotation.metadata.id;
    const previousValue = annotation.value;
    const db = getDb();

    return {
      name: "update annotation value",
      async apply() {
        const annotationToApply = await db?.get("annotations", annotationId);
        if (!annotationToApply)
          return showToast.error({
            title: "cannot update annotation, annotation not found",
          });

        const applyUpdatedAt = new Date();

        annotationToApply.value = value;
        annotationToApply.metadata.updatedAt = applyUpdatedAt;
        annotationToApply.metadata.metadata = annotation.metadata.metadata;
        annotationToApply.synced = false;

        await updateAnnotationIndexedDB({
          annotationToUpdate: annotationToApply,
        });
        await syncUpdatedAnnotation({
          annotationId,
          annotationToUpdate: annotationToApply,
          value,
          updatedAt: applyUpdatedAt,
        });
      },
      async undo() {
        const annotationToUndo = await db?.get("annotations", annotationId);
        if (!annotationToUndo) {
          return showToast.error({
            title: "cannot undo update annotation, annotation not found",
          });
        }

        const undoUpdatedAt = new Date();

        annotationToUndo.value = previousValue;
        annotationToUndo.metadata.updatedAt = undoUpdatedAt;
        annotationToUndo.synced = false;

        await updateAnnotationIndexedDB({
          annotationToUpdate: annotationToUndo,
        });
        await syncUpdatedAnnotation({
          annotationId,
          annotationToUpdate: annotationToUndo,
          value: previousValue,
          updatedAt: undoUpdatedAt,
        });
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on(
    "annotation.updateGroupCategory",
    async (props: { groupId: string; categoryIdToBeUpdate: string }) => {
      const { groupId, categoryIdToBeUpdate } = props;
      const db = getDb();

      const annotations = await db?.getGroupAnnotations(groupId);
      if (!annotations || annotations.length === 0) {
        return showErrorToast({
          title: "Not found annotation group to update",
        });
      }

      let beforeUpdateCategoryId: string | undefined = undefined;

      return {
        name: "update annotation group",
        async apply() {
          for (const annotationToApply of annotations) {
            beforeUpdateCategoryId = annotationToApply.value.category;
            const applyUpdatedAt = new Date();
            const annotationId = annotationToApply.metadata.id;
            const value = { category: categoryIdToBeUpdate };

            annotationToApply.value = value;
            annotationToApply.metadata.updatedAt = applyUpdatedAt;
            annotationToApply.synced = false;

            /** Upsert to IndexDB */
            await db?.upsertAnnotations([annotationToApply]);

            /** Sync to Database, with no setSelected */
            await syncUpdatedAnnotation({
              annotationId,
              annotationToUpdate: annotationToApply,
              value,
              updatedAt: applyUpdatedAt,
              setSelected: false,
            });
          }
        },
        async undo() {
          const undoUpdatedAt = new Date();
          for (const annotationToUndo of annotations) {
            annotationToUndo.value = { category: beforeUpdateCategoryId };
            annotationToUndo.metadata.updatedAt = undoUpdatedAt;
            annotationToUndo.synced = false;
            const annotationId = annotationToUndo.metadata.id;
            const value = { category: beforeUpdateCategoryId };

            /** Upsert to IndexDB */
            await db?.upsertAnnotations([annotationToUndo]);

            /** Sync to Database, with no setSelected */
            await syncUpdatedAnnotation({
              annotationId,
              annotationToUpdate: annotationToUndo,
              value,
              updatedAt: undoUpdatedAt,
              setSelected: false,
            });
          }
        },
        isCombinable: () => false,
        combine: (prevCmd) => prevCmd,
      };
    },
  );

  context.commands.on("annotation.delete", async (props: { annotationId: string }) => {
    const { annotationId } = props;
    const db = getDb();
    const snapshotAnnotation = await db?.get("annotations", annotationId);
    if (!snapshotAnnotation)
      return showToast.error({
        title: "cannot remove not found annotation",
      });

    return {
      name: "remove annotation",
      async apply() {
        await deleteAnnotationIndexedDB(annotationId);
        setIndexedDBUpdatedAt();
      },
      async undo() {
        const annotationToCreate = {
          ...snapshotAnnotation,
          metadata: {
            ...snapshotAnnotation.metadata,
            createdAt: snapshotAnnotation.metadata.createdAt,
            updatedAt: snapshotAnnotation.metadata.createdAt,
            metadata: {
              group_id: snapshotAnnotation.metadata.metadata?.group_id,
              parent_id: snapshotAnnotation.metadata.metadata?.parent_id,
            },
          },
          synced: false,
          locked: false,
          hidden: false,
        };

        await createAnnotationIndexedDB({ annotationToCreate });
        await syncCreatedAnnotation({ annotationId, annotationToCreate });
        setIndexedDBUpdatedAt();
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.deleteGroup", async (props: { groupId: string }) => {
    const { groupId } = props;
    const db = getDb();
    const snapshotAnnotations = await db?.getGroupAnnotations(groupId);
    if (!snapshotAnnotations || snapshotAnnotations.length === 0) {
      return showToast.error({
        title: "cannot remove not found annotation group",
      });
    }

    return {
      name: "remove annotation group",
      async apply() {
        for (const annotation of snapshotAnnotations) {
          const annotationId = annotation.metadata.id;
          await deleteAnnotationIndexedDB(annotationId);
        }
        setIndexedDBUpdatedAt();
      },
      async undo() {
        for (const annotation of snapshotAnnotations) {
          const annotationId = annotation.metadata.id;
          const annotationToCreate = {
            ...annotation,
            metadata: {
              ...annotation.metadata,
              createdAt: annotation.metadata.createdAt,
              updatedAt: annotation.metadata.updatedAt,
            },
            synced: false,
            locked: false,
            hidden: false,
          };

          await createAnnotationIndexedDB({ annotationToCreate });
          await syncCreatedAnnotation({ annotationId, annotationToCreate });
        }
        setIndexedDBUpdatedAt();
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.deleteAll", async () => {
    const db = getDb();
    const snapshotAnnotations = await db?.getAllStore("annotations");
    if (!snapshotAnnotations || snapshotAnnotations.length === 0) {
      return showToast.error({
        title: "cannot remove not found annotations",
      });
    }

    return {
      name: "remove all annotations",
      async apply() {
        for (const annotation of snapshotAnnotations) {
          const annotationId = annotation.metadata.id;
          await deleteAnnotationIndexedDB(annotationId);
        }
        setIndexedDBUpdatedAt();
      },
      async undo() {
        for (const annotation of snapshotAnnotations) {
          const annotationId = annotation.metadata.id;
          const annotationToCreate = {
            ...annotation,
            metadata: {
              ...annotation.metadata,
              createdAt: annotation.metadata.createdAt,
              updatedAt: annotation.metadata.updatedAt,
            },
            synced: false,
            locked: false,
            hidden: false,
          };

          await createAnnotationIndexedDB({ annotationToCreate });
          await syncCreatedAnnotation({ annotationId, annotationToCreate });
        }
        setIndexedDBUpdatedAt();
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.toggleVisibility", async (props: { annotationId: string }) => {
    const { annotationId } = props;
    const db = getDb();
    const snapshotAnnotation = await db?.get("annotations", annotationId);

    if (!snapshotAnnotation) {
      return showToast.error({
        title: "cannot toggle visibility of not found annotation",
      });
    }

    const wasHidden = snapshotAnnotation.hidden;

    return {
      name: "toggle visibility",
      apply: () => setVisibility(!wasHidden, snapshotAnnotation),
      undo: () => setVisibility(wasHidden, snapshotAnnotation),
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.toggleGroupVisibility", async (props: { groupId: string }) => {
    const { groupId } = props;
    const db = getDb();
    const snapshotAnnotations = await db?.getGroupAnnotations(groupId);

    if (!snapshotAnnotations || snapshotAnnotations.length === 0) {
      return showToast.error({
        title: "cannot toggle visibility of not found annotation group",
      });
    }

    const wasAllHidden = snapshotAnnotations.map((annotation) => annotation.hidden).every((hidden) => hidden);

    return {
      name: "toggle group visibility",
      async apply() {
        for (const annotation of snapshotAnnotations) {
          setVisibility(!wasAllHidden, annotation);
        }
      },
      async undo() {
        for (const annotation of snapshotAnnotations) {
          setVisibility(wasAllHidden, annotation);
        }
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.toggleAllVisibility", async () => {
    const db = getDb();
    const snapshotAnnotations = await db?.getAllStore("annotations");
    if (!snapshotAnnotations || snapshotAnnotations.length === 0) {
      return showToast.error({
        title: "cannot remove not found annotations",
      });
    }

    const wasAllHidden = snapshotAnnotations.map((annotation) => annotation.hidden).every((hidden) => hidden);

    return {
      name: "toggle all visibility",
      async apply() {
        for (const annotation of snapshotAnnotations) {
          setVisibility(!wasAllHidden, annotation);
        }
      },
      async undo() {
        for (const annotation of snapshotAnnotations) {
          setVisibility(wasAllHidden, annotation);
        }
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.toggleEditability", async (props: { annotationId: string }) => {
    const { annotationId } = props;
    const db = getDb();
    const snapshotAnnotation = await db?.get("annotations", annotationId);

    if (!snapshotAnnotation) {
      return showToast.error({
        title: "cannot toggle editability of not found annotation",
      });
    }

    const wasLocked = snapshotAnnotation.locked;

    return {
      name: "toggle editability",
      apply: () => setEditability(!wasLocked, snapshotAnnotation),
      undo: () => setEditability(wasLocked, snapshotAnnotation),
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.toggleGroupEditability", async (props: { groupId: string }) => {
    const { groupId } = props;
    const db = getDb();
    const snapshotAnnotations = await db?.getGroupAnnotations(groupId);

    if (!snapshotAnnotations || snapshotAnnotations.length === 0) {
      return showToast.error({
        title: "cannot toggle editability of not found annotation group",
      });
    }

    const wasAllLocked = snapshotAnnotations.map((annotation) => annotation.locked).every((locked) => locked);

    return {
      name: "toggle group editability",
      async apply() {
        for (const annotation of snapshotAnnotations) {
          setEditability(!wasAllLocked, annotation);
        }
      },
      async undo() {
        for (const annotation of snapshotAnnotations) {
          setEditability(wasAllLocked, annotation);
        }
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.toggleAllEditability", async () => {
    const db = getDb();
    const snapshotAnnotations = await db?.getAllStore("annotations");
    if (!snapshotAnnotations || snapshotAnnotations.length === 0) {
      return showToast.error({
        title: "cannot remove not found annotations",
      });
    }

    const wasAllLocked = snapshotAnnotations.map((annotation) => annotation.locked).every((locked) => locked);

    return {
      name: "toggle all visibility",
      async apply() {
        for (const annotation of snapshotAnnotations) {
          setEditability(!wasAllLocked, annotation);
        }
      },
      async undo() {
        for (const annotation of snapshotAnnotations) {
          setEditability(wasAllLocked, annotation);
        }
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("keyframe.add", async (props: { id: string; selection: ImageFrameSelection }) => {
    const { id: annotationId } = props;
    const db = getDb();

    const snapshotAnnotation = await db?.get("annotations", annotationId);
    if (!snapshotAnnotation)
      return showToast.error({
        title: "cannot add keyframe to not found annotation",
      });

    // Selection is snapshotted in component OR we should snapshot it here if it's reactive
    const selection = props.selection;
    const snapshotFrom = snapshotAnnotation.shape.frames.find((f: ImageFrameSelection) => f.frame == selection.frame);
    const snapshotStart = snapshotAnnotation.shape.start;
    const snapshotEnd = snapshotAnnotation.shape.end;

    return {
      name: "add bounding box selection",
      async apply() {
        const annotationToApply = await db?.get("annotations", annotationId);
        if (!annotationToApply)
          return showToast.error({
            title: "cannot add keyframe to not found Bounding box",
          });

        const applyUpdatedAt = new Date();
        annotationToApply.shape = {
          ...annotationToApply.shape,
          start: annotationToApply.shape.start <= selection.frame ? annotationToApply.shape.start : selection.frame,
          end: annotationToApply.shape.end >= selection.frame ? annotationToApply.shape.end : selection.frame,
          frames: [...annotationToApply.shape.frames.filter((frame) => frame.frame != selection.frame), selection],
        };
        annotationToApply.metadata.updatedAt = applyUpdatedAt;
        annotationToApply.synced = false;

        await updateAnnotationIndexedDB({
          annotationToUpdate: annotationToApply,
        });
        await syncUpdatedAnnotation({
          annotationId,
          annotationToUpdate: annotationToApply,
          value: annotationToApply.value,
          updatedAt: applyUpdatedAt,
        });
      },
      async undo() {
        const annotationToUndo = await db?.get("annotations", annotationId);
        if (!annotationToUndo)
          return showToast.error({
            title: "cannot undo add keyframe to not found Bounding box",
          });

        const undoUpdatedAt = new Date();
        annotationToUndo.shape = {
          ...annotationToUndo.shape,
          start: snapshotStart,
          end: snapshotEnd,
          frames: snapshotFrom
            ? [
                ...annotationToUndo.shape.frames.filter((frame: ImageFrameSelection) => frame.frame != selection.frame),
                snapshotFrom,
              ]
            : annotationToUndo.shape.frames.filter((frame: ImageFrameSelection) => frame.frame != selection.frame),
        };
        annotationToUndo.metadata.updatedAt = undoUpdatedAt;
        annotationToUndo.synced = false;

        await db?.deleteKeyFrame(annotationToUndo, selection.frame);
        await updateAnnotationIndexedDB({
          annotationToUpdate: annotationToUndo,
        });
        await syncUpdatedAnnotation({
          annotationId,
          annotationToUpdate: annotationToUndo,
          value: annotationToUndo.value,
          updatedAt: undoUpdatedAt,
        });
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("keyframe.delete", async (props: { annotationId: string; frame: number }) => {
    const { annotationId, frame: _frame } = props;
    const db = getDb();

    const snapshotAnnotation = await db?.get("annotations", props.annotationId);
    if (!snapshotAnnotation)
      return showToast.error({
        title: "cannot remove selection, annotation not found",
      });

    const deleteKeyFrameIndex = snapshotAnnotation.shape.frames.findIndex(
      (v: ImageFrameSelection) => v.frame == props.frame,
    );
    if (deleteKeyFrameIndex == -1) return showToast.error({ title: "No frame to remove" });
    const selection = snapshotAnnotation.shape.frames[deleteKeyFrameIndex];

    return {
      name: "delete bounding box keyframe",
      async apply() {
        const annotationToApply = await db?.get("annotations", props.annotationId);
        if (!annotationToApply)
          return showToast.error({
            title: "cannot remove keyframe, annotation not found",
          });

        const applyUpdatedAt = new Date();

        const index = annotationToApply.shape.frames.findIndex((v: ImageFrameSelection) => v.frame == props.frame);
        if (index == -1) return showToast.error({ title: "No frame to remove" });

        const newframes = annotationToApply.shape.frames.filter((v: ImageFrameSelection) => v.frame != props.frame);
        annotationToApply.metadata.updatedAt = applyUpdatedAt;
        annotationToApply.shape = {
          start: newframes.reduce(
            (acc: number, v: ImageFrameSelection) => (v.frame <= acc || acc == -1 ? v.frame : acc),
            -1,
          ),
          end: newframes.reduce(
            (acc: number, v: ImageFrameSelection) => (v.frame >= acc || acc == -1 ? v.frame : acc),
            -1,
          ),
          type: annotationToApply.shape.type,
          frames: newframes,
        };

        await updateAnnotationIndexedDB({
          annotationToUpdate: annotationToApply,
        });
        await syncUpdatedAnnotation({
          annotationId,
          annotationToUpdate: annotationToApply,
          value: annotationToApply.value,
          updatedAt: applyUpdatedAt,
        });
      },
      async undo() {
        const undoUpdatedAt = new Date();
        const annotationToUndo = await db?.get("annotations", annotationId);
        if (!annotationToUndo) {
          return showToast.error({
            title: "cannot undo remove selection, annotation not found",
          });
        }

        const newframes = [...annotationToUndo.shape.frames.filter((v) => v.frame != props.frame), selection];
        annotationToUndo.shape = {
          start: newframes.reduce((acc, v) => (v.frame <= acc || acc == -1 ? v.frame : acc), -1),
          end: newframes.reduce((acc, v) => (v.frame >= acc || acc == -1 ? v.frame : acc), -1),
          type: annotationToUndo.shape.type,
          frames: newframes,
        };
        annotationToUndo.metadata.updatedAt = undoUpdatedAt;
        annotationToUndo.synced = false;

        await db?.addKeyFrame(annotationToUndo, selection);
        setSelectedAnnotation(annotationToUndo);
        setIndexedDBUpdatedAt();
        await syncUpdatedAnnotation({
          annotationId,
          annotationToUpdate: annotationToUndo,
          value: snapshotAnnotation.value,
          updatedAt: undoUpdatedAt,
        });
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on(
    "command_dialog",
    () => {
      return {
        name: "Toggle shortcut guide",
        apply: () => {
          uiStore.toggleCommandDialog();
        },
        undo: () => {},
        isCombinable: () => true,
        combine: (c) => c,
      };
    },
    false,
  );
}
