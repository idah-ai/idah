import { writable } from "svelte/store";

import { DatasetRecord } from "@/data/model/dataset/dataset-record";

export const selectedDatasets = writable<DatasetRecord[]>([]);
