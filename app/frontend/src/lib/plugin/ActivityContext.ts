import { goto } from "$app/navigation";

import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
import { noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";

import type { Command } from "@/command/Command";
import CommandManager from "@/command/CommandManager";

import { noteSidebarStore } from "../../plugins/idah-video/layout/sidebar/notes/note-sidebar-stores";
import { createAnnotationDriver } from "./AnnotationDriver";
import { createNoteDriver, parseNoteFeedRecordToINoteFeed } from "./NoteDriver";
import type { HeaderBarModeTool, IActivityContext, ITools } from "./interface/Activity";

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
    async gotoFeed(noteFeedId: string, noteCommentId?: string): Promise<void> {
      const noteFeedRes = await noteFeedsBackendDataSource.get(noteFeedId);
      const noteFeed = noteFeedRes.data;
      const generalNoteType = noteFeed.anchor_type === "entry" && Object.keys(noteFeed.position || {}).length === 0;

      if (noteCommentId) {
        // TODO: Scroll to the specific note comment in the note feed detail view
        noteSidebarStore.update((store) => ({
          ...store,
          selectedNoteCommentId: noteCommentId,
        }));
      }

      /**
       * Open the note sidebar
       */
      setTimeout(() => {
        noteSidebarStore.update((store) => ({
          ...store,
          open: true,
        }));
      }, 700);

      /**
       * Show the note feed popup / sidebar detail after a delay
       */
      setTimeout(() => {
        noteSidebarStore.update((store) => {
          if (generalNoteType) {
            return {
              ...store,
              selectedNoteFeed: parseNoteFeedRecordToINoteFeed(noteFeed),
            };
          } else {
            return {
              ...store,
              noteFeedPopup: {
                show: true,
                noteFeed: parseNoteFeedRecordToINoteFeed(noteFeed),
              },
            };
          }
        });
      }, 1000);
    },
    commands: createCommandsInterface(),
    tools: createToolsInterface(),
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
