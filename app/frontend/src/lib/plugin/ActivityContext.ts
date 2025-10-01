import type { IActivityContext, INote, INoteDriver } from "./interface/Activity";
import { createAnnotationDriver } from "./AnnotationDriver";
import { goto } from "$app/navigation";
import type { EntryRecord } from "@/data/model/dataset/entries/record";

const noteDriver: INoteDriver = {
  create(position, content) {
    return new Promise<INote>((resolve, reject) => {
      reject("todo");
    });
  },
  list(filter) {
    return new Promise<INote[]>((resolve, reject) => {
      reject("todo");
    });
  },
};

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
    notes: noteDriver,
    back() {
      const path = `/projects/${entry.dataset.project.id}/datasets/${entry.dataset.id}/tasks`;
      goto(path);
    },
    submit() {
      return new Promise<void>((resolve, reject) => {
        reject("todo");
      });
    },
    error(message: string) {
      return new Promise<void>((resolve, reject) => {
        reject(message); // ?
      });
    },
  };
}
