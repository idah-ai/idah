import { z } from "zod";
import { datasetsModalities } from "./constants";

export const datasetSchema = z.object({
  name: z.string("Dataset name is required."),

  // labels

  // modality: z.string("Dataset modality is required."),
  modality: z.enum(
    datasetsModalities.map((m) => m.value),
    {
      message: "Please select a modality.",
    },
  ),

  // labeling_configuration
  // workflow_configuration
  // status
  // progress

  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

export const createDatasetSchema = datasetSchema.pick({
  name: true,
  modality: true,
});

export const updateDatasetSchema = createDatasetSchema.pick({
  name: true,
});
