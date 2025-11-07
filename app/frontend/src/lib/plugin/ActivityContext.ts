import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import type { Command } from "@/command/Command";
import CommandManager from "@/command/CommandManager";
import type { EntryRecord } from "@/data/model/dataset/entries/record";
import { createAnnotationDriver } from "./AnnotationDriver";
import type { HeaderBarModeTool, IActivityContext, INote, INoteDriver, ITools } from "./interface/Activity";

const noteDriver: INoteDriver = {
  create(position, content) {
    return new Promise<INote>((_resolve, reject) => {
      reject({ position, content });
    });
  },
  list(filter) {
    return new Promise<INote[]>((_resolve, reject) => {
      reject({ filter });
    });
  },
};

function createCommandsInterface() {
  const commands = new Map();

  return {
    on: (name: string, builder: (props?: object) => Command, manager = true) => {
      commands.set(name, { manager, builder });
      console.debug({ command_on: name, manager });
    },
    async run(name: string, props?: object) {
      const { manager, builder }: { manager: boolean; builder: (props?: object) => Command } = commands.get(name);

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
    // config: entry.dataset.labeling_configuration,
    config: {
      "video:bounding_box": {
        values: [
          { id: "vehicle/car", label: "Car", description: "", color: "", textColor: "" },
          { id: "vehicle/truck", label: "Truck", description: "", color: "", textColor: "" },
          { id: "vehicle/bike", label: "Bike", description: "", color: "", textColor: "" },
          { id: "vehicle/other", label: "Other", description: "", color: "", textColor: "" },
          { id: "person/adult", label: "Adult", description: "", color: "", textColor: "" },
          { id: "person/child", label: "Child", description: "", color: "", textColor: "" },
        ],
        properties: [
          {
            id: "brand",
            label: "Brand",
            type: "text",
            required: true,
            visibility: ["match", [["get", ["annotation.value.category"]], "vehicle/*"]],
            format: {
              minimum: 1,
              maximum: 100,
            },
          },
          {
            id: "age",
            label: "Age",
            type: "integer",
            visibility: ["match", [["get", ["annotation.value.category"]], "person/*"]],
            required: true,
            format: {
              minimum: 1,
            },
          },
        ],
      },
      "video:polygon_box": {
        values: [
          { id: "vehicle/car", label: "Car", description: "", color: "", textColor: "" },
          { id: "vehicle/truck", label: "Truck", description: "", color: "", textColor: "" },
          { id: "vehicle/bike", label: "Bike", description: "", color: "", textColor: "" },
          { id: "vehicle/other", label: "Other", description: "", color: "", textColor: "" },
          { id: "person/adult", label: "Adult", description: "", color: "", textColor: "" },
          { id: "person/child", label: "Child", description: "", color: "", textColor: "" },
        ],
        properties: [
          {
            id: "brand",
            label: "Brand",
            type: "text",
            required: true,
            visibility: ["match", [["get", ["annotation.value.category"]], "vehicles/*"]],
            format: {
              minimum: 1,
              maximum: 100,
            },
          },
          {
            id: "age",
            label: "Age",
            type: "integer",
            visibility: ["match", [["get", ["annotation.value.category"]], "person/*"]],
            required: true,
            format: {
              minimum: 1,
            },
          },
        ],
      },
      "video:framed_tag": {
        values: [
          { id: "accident", label: "Accident", description: "", color: "", textColor: "" },
          { id: "traffic", label: "Traffic", description: "", color: "", textColor: "" },
        ],
        properties: [
          {
            id: "entity_concerned",
            label: "visible number of entity impacted",
            type: "integer",
            visibility: ["match", [["get", ["annotation.value.category"]], "*"]],
            required: false,
            format: {},
          },
          {
            id: "rightofway",
            label: "Right of way",
            type: "single-select",
            visibility: ["eq", [["get", ["annotation.value.category"]], "traffic"]],
            required: true,
            format: {
              options: [
                { id: "row.vehicle", label: "Vehicle" },
                { id: "row.pedestrian", label: "Pedestrian" },
              ],
            },
          },
        ],
      },
      "video:ranged_tag": {
        values: [
          { id: "accident", label: "Accident", description: "", color: "", textColor: "" },
          { id: "traffic", label: "Traffic", description: "", color: "", textColor: "" },
        ],
        properties: [
          {
            id: "entity_concerned",
            label: "visible number of entity impacted",
            type: "integer",
            visibility: ["match", [["get", ["annotation.value.category"]], "*"]],
            required: false,
            format: {},
          },
          {
            id: "rightofway",
            label: "Right of way",
            type: "single-select",
            visibility: ["eq", [["get", ["annotation.value.category"]], "traffic"]],
            required: true,
            format: {
              options: [
                { id: "row.vehicle", label: "Vehicle" },
                { id: "row.pedestrian", label: "Pedestrian" },
              ],
            },
          },
        ],
      },
      "entry:root": {
        values: [
          // in case of entry:root I'm assuming those should be either unique or exclusive
          { id: "entry:root", label: "Unique Entry Annotation", description: "", color: "", textColor: "" },
        ],
        properties: [
          // any configuration of properties or none :) ..
        ],
      },
    },
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
