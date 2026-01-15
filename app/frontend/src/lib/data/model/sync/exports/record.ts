import { createBackendDataSource } from "@/data/BackendDataSource";
import { Record, RecordFactory, type } from "@/data/model/Record";

@type("sync:exports")
export class ExportRecord extends Record {}

RecordFactory.registerTypes(ExportRecord);

const exportsBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/sync/exports`;

export const ExportsBackendDataSource = createBackendDataSource(ExportRecord, exportsBasePath, {
  export: async (filter) => {
    await fetch(`${exportsBasePath}/export`, {
      method: "POST",
      body: JSON.stringify({
        filter: filter,
      }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });
  },
});
