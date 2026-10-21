import { z } from "zod";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";

const calendarDateSchema = z.string().refine((value) => {
  try {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && parseDate(value).toString() === value;
  } catch {
    return false;
  }
}, "Enter a valid date (YYYY-MM-DD).");

// Validate selections, not stored dates: D3 permits existing dates outside new bounds.
export const deliveryDateChangeSchema = z
  .object({
    delivery_date: calendarDateSchema.nullable().optional(),
    original_delivery_date: calendarDateSchema.nullable().optional(),
    dataset_delivery_date: calendarDateSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.delivery_date == null || data.delivery_date === data.original_delivery_date) return;
    if (!calendarDateSchema.safeParse(data.delivery_date).success) return;
    if (data.dataset_delivery_date && !calendarDateSchema.safeParse(data.dataset_delivery_date).success) return;
    const selected = parseDate(data.delivery_date);
    if (selected.compare(today(getLocalTimeZone())) < 0) {
      ctx.addIssue({ code: "custom", path: ["delivery_date"], message: "Delivery Date must be today or later." });
    }
    if (data.dataset_delivery_date && selected.compare(parseDate(data.dataset_delivery_date)) > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery_date"],
        message: "Delivery Date must be on or before the Dataset Delivery Date.",
      });
    }
  });

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
