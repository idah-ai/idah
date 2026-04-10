import { get } from "svelte/store";
import { uuidv7 } from "uuidv7";

import { showToast } from "$lib/components/ui/toast/index.svelte";
import {
  DEFAULT_MODE,
  ENTRY_ROOT,
  IDAH_NOTE,
  IDAH_VIDEO_BOUNDING_BOX,
  IDAH_VIDEO_POLYGON,
  IDAH_VISUAL,
} from "$lib/plugin/type";
import {
  type InterpolatedVertex,
  type Point,
  type VideoAnnotationObject,
  type VideoFrameSelection,
  type VideoShape,
  getInterpolatedFrame,
} from "$lib/plugin/video-annotation-activity/context/video-annotation-context";
import {
  entryRoot,
  setEntryRoot,
  setIndexedDBUpdatedAt,
} from "$lib/plugin/video-annotation-activity/store/idb-store.svelte";
import {
  deselectAnnotation,
  deselectAnnotationGroup,
  selectedAnnotation,
  setCurrentModeTo,
  setSelectedAnnotation,
} from "$lib/plugin/video-annotation-activity/store/store";
import { uiStore } from "$lib/plugin/video-annotation-activity/store/ui-store.svelte";
import { showErrorToast } from "$lib/utils/error/error.toasts";

import type { IActivityContext } from "$idah/context/activity-context";
import type { AnnotationValue } from "$idah/context/annotation-context";
import type { AnnotationBackend } from "$lib/plugin/video-annotation-activity/data/annotation/annotaiton-backend.svelte";

interface CommandContext {
  context: IActivityContext;
  getDb: () => AnnotationBackend | undefined;
  updaters: {
    setAnnotationValue: (value: AnnotationValue) => void;
    selectAnnotation: (annotation?: VideoAnnotationObject) => void;
  };
}

export function registerCommands(params: CommandContext) {
  const { context, getDb, updaters } = params;

  /** HELPER FUNCTIONS */
  async function createAnnotationIndexedDB(props: { annotationToCreate: VideoAnnotationObject }) {
    const { annotationToCreate } = props;
    const db = getDb();

    updaters.selectAnnotation(annotationToCreate);
    await db?.upsertAnnotations([annotationToCreate]);
    entryRoot.set(annotationToCreate.shape.type == ENTRY_ROOT ? annotationToCreate : undefined);
  }

  async function updateAnnotationIndexedDB(props: { annotationToUpdate: VideoAnnotationObject }) {
    const { annotationToUpdate } = props;
    const db = getDb();

    await db?.upsertAnnotations([annotationToUpdate]);
    updaters.selectAnnotation(annotationToUpdate);
    if (get(entryRoot)?.metadata.id == annotationToUpdate.metadata.id) setEntryRoot(annotationToUpdate);
    setIndexedDBUpdatedAt();
  }

  async function syncCreatedAnnotation(props: {
    annotationId: string;
    annotationToCreate: VideoAnnotationObject;
    setSelected?: boolean;
  }) {
    const { annotationId, annotationToCreate, setSelected = true } = props;
    const db = getDb();

    await context.annotations
      .create(annotationId, annotationToCreate.shape, annotationToCreate.value, annotationToCreate.metadata.metadata)
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
    annotationToUpdate: VideoAnnotationObject;
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

  function setVisibility(hidden: boolean, annotation?: VideoAnnotationObject) {
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

  function setEditability(locked: boolean, annotation?: VideoAnnotationObject) {
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

  // Helper function to normalize interpolated points to Point[]
  function normalizePoints(points: Point[] | InterpolatedVertex[] | undefined): Point[] | undefined {
    if (!points) return undefined;
    if (points.length > 0 && typeof points[0] === "object" && "point" in points[0]) {
      return (points as InterpolatedVertex[]).map((item) => item.point);
    }
    return points as Point[];
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
        setCurrentModeTo(IDAH_VISUAL);
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
        setCurrentModeTo(IDAH_VIDEO_BOUNDING_BOX);
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
        setCurrentModeTo(IDAH_NOTE);
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
        setCurrentModeTo(IDAH_VIDEO_POLYGON);
        deselectAnnotation();
        deselectAnnotationGroup();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  /** ANNOTATION COMMANDS */
  context.commands.on("annotation.add", (props: { shape: VideoShape; value: AnnotationValue }) => {
    const { shape, value } = props;
    const uuid = uuidv7();

    return {
      name: "new annotation",
      async apply() {
        const applyCreatedAt = new Date();
        const annotationToCreate: VideoAnnotationObject = {
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

  context.commands.on("annotation.update", (props: { annotation: VideoAnnotationObject; value: AnnotationValue }) => {
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
        const undoCreatedAt = new Date();
        let annotationToCreate = {
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
          let annotationToCreate = {
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
          let annotationToCreate = {
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

  context.commands.on("annotation.split", async (props: { id: string; at: number }) => {
    const db = getDb();
    const annotation = await db?.get("annotations", props.id);

    if (!annotation)
      return showToast.error({
        title: "cannot split annotation, annotation not found",
      });

    const splitAt = props.at;

    if (annotation.shape.start >= splitAt) return console.log("cannot split before/at start frame");
    if (annotation.shape.end < splitAt) return console.log("cannot split after end frame");

    const newId = uuidv7();
    const createdAt = new Date();

    const originalEnd = annotation.shape.end;
    const originalFrames = annotation.shape.frames;
    const originalUpdatedAt = annotation.metadata.updatedAt;
    const originalGroupId = annotation.metadata.metadata?.group_id;

    const part1End = splitAt - 1;
    const part1Frames = annotation.shape.frames.filter((f: VideoFrameSelection) => f.frame <= part1End);

    if (!part1Frames.find((f: VideoFrameSelection) => f.frame === part1End)) {
      const interpolated = getInterpolatedFrame(annotation.shape as VideoShape, part1End);
      if (interpolated) {
        const normalizedPoints = normalizePoints(interpolated.points);
        if (normalizedPoints) {
          part1Frames.push({
            frame: part1End,
            points: normalizedPoints,
            angle: interpolated.angle || 0,
          });
        }
      }
      part1Frames.sort((a, b) => a.frame - b.frame);
    }

    const part2Start = splitAt;
    const part2End = splitAt === annotation.shape.end ? part2Start : originalEnd;
    const part2Frames = annotation.shape.frames.filter((f: VideoFrameSelection) => f.frame >= part2Start);

    if (!part2Frames.find((f: VideoFrameSelection) => f.frame === part2Start)) {
      const interpolated = getInterpolatedFrame(annotation.shape as VideoShape, part2Start);
      if (interpolated) {
        const normalizedPoints = normalizePoints(interpolated.points);
        if (normalizedPoints) {
          part2Frames.push({
            frame: part2Start,
            points: normalizedPoints,
            angle: interpolated.angle || 0,
          });
        }
      }
      part2Frames.sort((a, b) => a.frame - b.frame);
    }

    const groupId = originalGroupId || annotation.metadata.id;

    return {
      name: "split annotation",
      async apply() {
        const a1 = await db?.get("annotations", props.id);

        if (a1) {
          a1.shape.end = part1End;
          a1.shape.frames = part1Frames;
          a1.metadata.updatedAt = createdAt;
          a1.metadata.metadata = {
            ...annotation.metadata.metadata,
            group_id: groupId,
          };
          a1.synced = false;
          await db?.upsertAnnotations([a1]);
          let p = context.annotations.update({
            id: a1.metadata.id,
            dimensions: a1.shape,
            annotation: a1.value,
            metadata: a1.metadata.metadata,
          });

          p.then(async () => {
            const annotation = await db?.get("annotations", props.id);
            if (annotation && annotation.metadata.updatedAt.valueOf() == createdAt.valueOf()) {
              annotation.synced = true;
              if (get(entryRoot)?.metadata.id == annotation.metadata.id) entryRoot.set(annotation);
              await db?.upsertAnnotations([annotation]);
              setIndexedDBUpdatedAt();
            }
          });
        }

        let a2 = {
          ...annotation,
          shape: {
            ...annotation.shape,
            start: part2Start,
            end: part2End,
            frames: part2Frames,
          },
          value: { ...annotation.value },
          metadata: {
            ...annotation.metadata,
            id: newId,
            createdAt,
            updatedAt: createdAt,
            metadata: {
              group_id: groupId,
              parent_id: annotation.metadata.id,
            },
          },
          synced: false,
          locked: false,
          hidden: false,
        };

        if (a2.shape.type == ENTRY_ROOT) entryRoot.set(a2);

        await db?.upsertAnnotations([a2]);
        setIndexedDBUpdatedAt();

        let p2 = context.annotations.create(newId, a2.shape, a2.value, a2.metadata.metadata);
        p2.then(async () => {
          const annotation = await db?.get("annotations", newId);
          if (annotation && annotation.metadata.updatedAt.valueOf() == createdAt.valueOf()) {
            annotation.synced = true;
            if (get(entryRoot)?.metadata.id == annotation.metadata.id) entryRoot.set(annotation);
            await db?.upsertAnnotations([annotation]);
            setIndexedDBUpdatedAt();
            selectedAnnotation.set(annotation);
          }
        });
      },
      async undo() {
        const a1 = await db?.get("annotations", props.id);
        if (a1) {
          a1.shape.end = originalEnd;
          a1.shape.frames = originalFrames;
          a1.metadata.updatedAt = originalUpdatedAt;

          if (originalGroupId === undefined) {
            if (a1.metadata.metadata) delete a1.metadata.metadata.group_id;
          } else {
            if (!a1.metadata.metadata) a1.metadata.metadata = {};
            a1.metadata.metadata.group_id = originalGroupId;
          }

          a1.synced = false;
          await db?.upsertAnnotations([a1]);

          let p = context.annotations.update({
            id: a1.metadata.id,
            dimensions: a1.shape,
            annotation: a1.value,
            metadata: a1.metadata.metadata,
          });

          p.then(async () => {
            const annotation = await db?.get("annotations", props.id);
            if (annotation && annotation.metadata.updatedAt.valueOf() == originalUpdatedAt.valueOf()) {
              annotation.synced = true;
              if (get(entryRoot)?.metadata.id == annotation.metadata.id) entryRoot.set(annotation);
              await db?.upsertAnnotations([annotation]);
              setIndexedDBUpdatedAt();
              selectedAnnotation.set(annotation);
            }
          });
        }

        await db?.deleteAnnotation(newId);
        setIndexedDBUpdatedAt();
        context.annotations.delete(newId);

        if (get(entryRoot)?.metadata.id == newId) entryRoot.set(undefined);
      },
      isCombinable: () => false,
      combine: (c) => c,
    };
  });

  context.commands.on("keyframe.add", async (props: { id: string; selection: VideoFrameSelection }) => {
    const { id: annotationId } = props;
    const db = getDb();

    const snapshotAnnotation = await db?.get("annotations", annotationId);
    if (!snapshotAnnotation)
      return showToast.error({
        title: "cannot add keyframe to not found annotation",
      });

    // Selection is snapshotted in component OR we should snapshot it here if it's reactive
    const selection = props.selection;
    const snapshotFrom = snapshotAnnotation.shape.frames.find((f: VideoFrameSelection) => f.frame == selection.frame);
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
                ...annotationToUndo.shape.frames.filter((frame: VideoFrameSelection) => frame.frame != selection.frame),
                snapshotFrom,
              ]
            : annotationToUndo.shape.frames.filter((frame: VideoFrameSelection) => frame.frame != selection.frame),
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

    let deleteKeyFrameIndex = snapshotAnnotation.shape.frames.findIndex(
      (v: VideoFrameSelection) => v.frame == props.frame,
    );
    if (deleteKeyFrameIndex == -1) return showToast.error({ title: "No frame to remove" });
    let selection = snapshotAnnotation.shape.frames[deleteKeyFrameIndex];

    return {
      name: "delete bounding box keyframe",
      async apply() {
        const annotationToApply = await db?.get("annotations", props.annotationId);
        if (!annotationToApply)
          return showToast.error({
            title: "cannot remove keyframe, annotation not found",
          });

        const applyUpdatedAt = new Date();

        let index = annotationToApply.shape.frames.findIndex((v: VideoFrameSelection) => v.frame == props.frame);
        if (index == -1) return showToast.error({ title: "No frame to remove" });

        let newframes = annotationToApply.shape.frames.filter((v: VideoFrameSelection) => v.frame != props.frame);
        annotationToApply.metadata.updatedAt = applyUpdatedAt;
        annotationToApply.shape = {
          start: newframes.reduce(
            (acc: number, v: VideoFrameSelection) => (v.frame <= acc || acc == -1 ? v.frame : acc),
            -1,
          ),
          end: newframes.reduce(
            (acc: number, v: VideoFrameSelection) => (v.frame >= acc || acc == -1 ? v.frame : acc),
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
        let annotationToUndo = await db?.get("annotations", annotationId);
        if (!annotationToUndo) {
          return showToast.error({
            title: "cannot undo remove selection, annotation not found",
          });
        }

        let newframes = [...annotationToUndo.shape.frames.filter((v) => v.frame != props.frame), selection];
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
