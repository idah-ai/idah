import type { IActivityContext, INote, INoteDriver } from "./interface/Activity";
import { createAnnotationDriver } from "./AnnotationDriver";
import { goto } from "$app/navigation";
import type { EntryRecord } from "@/data/model/dataset/entries/record";
import type { Command } from "@/command/Command";
import CommandManager from "@/command/CommandManager";

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


function createCommands() {
  const commands = new Map()

  return {
    on: (name: string, command_builder:(props:any) => Command) => {
      commands.set(name, command_builder)
      console.log({commands})
    },
    async run(name: string, props:any){
      const builder = commands.get(name)

      if (!builder)
        return console.error("builder not found command:", name)

      const command = await builder(props)

      if (!commands) // properly extract and we shouldnt have to await
        return console.error("builder error on command:", name)

      CommandManager.add(command)
    },
    undo(times?: number) { CommandManager.undo(times) },
    redo(times?: number) { CommandManager.redo(times) }
  }

}

export function activityContextForEntry(entry: EntryRecord): IActivityContext {
  return {
    id: entry.id,
    type: entry.dataset.modality,
    workflowStep: entry.wf_step,
    status: entry.status,
    config: entry.dataset.labeling_configuration,
    mediaUrl: [
      `${import.meta.env.VITE_IDAH_HOST}/api/v1/media/medias/files`,
      entry.resource,
      "master.m3u8"
    ].join("/"),
    user: {
      id: 0,
      email: "",
      name: "",
      pictureUrl: "",
    },
    userRole: "",
    annotations: createAnnotationDriver(entry.id),
    notes: noteDriver,
    commands: createCommands(),
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
