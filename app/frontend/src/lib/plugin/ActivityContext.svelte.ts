import { goto } from "$app/navigation";
import { resolve } from "$app/paths";

import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";

import type { Command } from "@/command/Command";
import CommandManager from "@/command/CommandManager";

import { createAnnotationDriver } from "./AnnotationDriver";
import { createNoteDriver } from "./NoteDriver";

import type { HeaderBarModeTool, IActivityContext, ITools } from "./interface/Activity";
import { SvelteMap } from "svelte/reactivity";

function createCommandsInterface() {
  const commands = new SvelteMap<string, { manager: boolean; builder: (props?: object) => Command }>();

  return {
    on: (name: string, builder: (props?: object) => Command, manager = true) => {
      commands.set(name, { manager, builder });
      console.debug({ command_on: name, manager });
    },
    async run(name: string, props?: object) {
      const entry = commands.get(name);
      if (!entry) return console.error("builder not found command:", name);

      const { manager, builder } = entry;
      const command = await builder(props);

      if (!command)
        return console.error("builder error on command:", name);

      console.debug({ command_run: name, props, command });
      if (manager) CommandManager.add(command);
      else command.apply();
    },
    undo(times?: number) {
      console.debug({ command_undo: { times } });
      CommandManager.undo(times);
    },
    redo(times?: number) {
      console.debug({ command_redo: { times } });
      CommandManager.redo(times);
    },
  };
}

function createToolsInterface(): ITools {
  let _onToolsChange: ((tools: HeaderBarModeTool[]) => void) | undefined;
  let _onToolChange: ((tool: string) => void) | undefined;

  return {
    setTools: (tools: HeaderBarModeTool[]) => {
      console.debug({ tools });
      _onToolsChange?.(tools);
    },
    setTool: (tool: string) => {
      console.debug({ tool });
      _onToolChange?.(tool);
    },
    onToolsChange: (cb) => (_onToolsChange = cb),
    onToolChange: (cb) => (_onToolChange = cb),
  };
}

export function activityContextForEntry(entry: EntryRecord): IActivityContext {
  let shortcutReferencesList = $state<Record<string, { label: string; description: string; keyCombinations: string[] }>>({});

  const context: IActivityContext = {
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
    notes: createNoteDriver(),
    commands: createCommandsInterface(),
    tools: createToolsInterface(),
    back() {
      goto(
        resolve("/(app)/projects/[projectId]/datasets/[datasetId]/entries", {
          projectId: entry.dataset.project.id,
          datasetId: entry.dataset.id,
        }),
      );
    },
    submit(opts?: { approved: boolean }) {
      return new Promise<void>((res, rej) => {
        entriesBackendDataSource
          .submit(entry.id, opts)
          .then(async () => {
            try {
              const datasetsRes = await datasetsBackendDataSource.list({
                fields: {
                  [DatasetRecord.type]: ["id"],
                },
                noCache: true,
              });
              if (datasetsRes.data.length) {
                goto(resolve(`/projects/${entry.dataset.project.id}/datasets/${entry.dataset.id}/entries`));
              } else {
                goto(resolve(`/projects/${entry.dataset.project.id}/datasets`));
              }
            } catch (error) {
              console.error(error);
              goto(resolve(`/projects/${entry.dataset.project.id}/datasets`));
            }
          })
          .then(
            (_v) => res(),
            (_e) => rej(),
          );
      });
    },
    error(message: string) {
      return new Promise<void>((resolve, reject) => {
        reject(message); // ?
      });
    },
    get shortcutReferences() {
      return shortcutReferencesList;
    },
    registerShortcutReferences(refs: Record<string, { label: string; description: string; keyCombinations: string[] }>) {
      shortcutReferencesList = refs;
    },
  };

  return context;
}
