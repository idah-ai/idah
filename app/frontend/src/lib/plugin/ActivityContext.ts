import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import type { Pathname } from "$app/types";

import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";

import type { Command } from "@/command/Command";
import CommandManager from "@/command/CommandManager";

import { createAnnotationDriver } from "./AnnotationDriver";
import type { HeaderBarModeTool, IActivityContext, INoteFeed, INotes, ITools } from "./interface/Activity";

function createCommandsInterface() {
  const commands = new Map();

  return {
    on: (name: string, builder: (props: any) => Command, manager = true) => {
      commands.set(name, { manager, builder });
      console.debug({ command_on: name, manager });
    },
    async run(name: string, props: any) {
      const { manager, builder }: { manager: boolean; builder: (props: any) => Command } = commands.get(name);

      if (!builder) return console.error("builder not found command:", name);

      const command = await builder(props);

      if (!commands)
        // properly extract and we shouldnt have to await ?
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

function createNotesInterface(): INotes {
  let _onNoteSelected: ((noteFeedId: string | null, noteCommentId?: string) => void) | undefined;
  let _onNewNoteFeedOpenChange:
    | ((data: Pick<INoteFeed, "anchor_type" | "position" | "annotation_id">) => void)
    | undefined;

  return {
    showNewNoteFeedPopup: (data: Pick<INoteFeed, "anchor_type" | "position" | "annotation_id">) => {
      _onNewNoteFeedOpenChange?.(data);
    },
    onNewNoteFeedOpenChange: (cb) => (_onNewNoteFeedOpenChange = cb),

    gotoFeed: (noteFeedId: string | null, noteCommentId?: string) => {
      _onNoteSelected?.(noteFeedId, noteCommentId);
    },
    onNoteSelected: (cb) => (_onNoteSelected = cb),
  };
}

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
    notes: createNotesInterface(),
    commands: createCommandsInterface(),
    tools: createToolsInterface(),
    back() {
      const path: Pathname = `/projects/${entry.dataset.project.id}/datasets/${entry.dataset.id}/tasks`;
      goto(resolve(path));
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
