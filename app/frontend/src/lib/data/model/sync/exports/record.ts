import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";

@type("sync:exports")
export class ExportRecord extends Record {
  @field() public filename!: string;
  @field() public size!: number;
  @field() public mime_type!: string;
}

RecordFactory.registerTypes(ExportRecord);

const exportsBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/sync/exports`;

export function export_download_path(id: string) {
  return `${exportsBasePath}/${id}/download`;
}
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
  download: async (id) => {
    await fetch(export_download_path(id));
  },
});
