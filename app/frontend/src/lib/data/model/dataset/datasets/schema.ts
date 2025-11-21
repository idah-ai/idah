import { z } from "zod";

export const datasetSchema = z.object({
  name: z.string("Dataset name is required."),

  // labels

  // modality: z.string("Dataset modality is required."),
  modality: z.string("Dataset modality is required.").min(1, "Dataset modality is required."),

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
