import { createBackendDataSource } from "@/data/BackendDataSource";
import { Record, RecordFactory, type } from "@/data/model/Record";

@type("sync:jobs")
export class JobExportRecord extends Record {}

RecordFactory.registerTypes(JobExportRecord);

const exportBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/sync`;

export const ExportBackendDataSource = createBackendDataSource(JobExportRecord, exportBasePath, {
  // getInfo: async() => {},

  export: async (params) => {
    let path = `${exportBasePath}/export`;
    const filters = Object.entries(params)
      .flatMap(([type, filters]) =>
        Object.entries(filters).map(([filter, value]) => (value ? `filter[${type}][${filter}]=${value}` : null)),
      )
      .filter((f) => f != null)
      .join("&");

    console.log(filters);

    path = filters.length ? [path, filters].join("?") : path;

    await fetch(path, {
      method: "GET",
    }); // cookie ?
  },
});
