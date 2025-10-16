import { goto } from "$app/navigation";

import { entriesBackendDataSource, type EntryRecord } from "@/data/model/dataset/entries/record";

import { createAnnotationDriver } from "./AnnotationDriver";
import { createNoteDriver } from "./NoteDriver";

import type { IActivityContext } from "./interface/Activity";

export function activityContextForEntry(entry: EntryRecord): IActivityContext {
  return {
    id: entry.id,
    type: entry.dataset.modality,
    workflowStep: entry.wf_step,
    status: entry.status,
    config: entry.dataset.labeling_configuration,
    mediaUrl: [`${import.meta.env.VITE_IDAH_HOST}/api/v1/media/medias/files`, entry.resource, "master.m3u8"].join("/"),
    user: {
      id: 0,
      email: "",
      name: "",
      pictureUrl: "",
    },
    userRole: "",
    annotations: createAnnotationDriver(entry.id),
    notes: createNoteDriver(entry.id),
    back() {
      const path = `/projects/${entry.dataset.project.id}/datasets/${entry.dataset.id}/tasks`;
      goto(path);
    },
    submit(opts?: { approved: boolean }) {
      return new Promise<void>((resolve, reject) => {
        entriesBackendDataSource.submit(entry.id, opts).then(
          (_v) => resolve(),
          (_e) => reject(),
        );
      });
    },
    error(message: string) {
      return new Promise<void>((resolve, reject) => {
        reject(message); // ?
      });
    },
  };
}
