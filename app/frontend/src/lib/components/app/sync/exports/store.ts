import { writable } from "svelte/store";

import { ExportRecord } from "@/data/model/sync/exports/record";

export const exportingExportRecords = writable<ExportRecord[]>([]);
