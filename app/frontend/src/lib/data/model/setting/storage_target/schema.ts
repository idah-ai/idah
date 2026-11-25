import { z } from "zod";

const endpoint = z
  .string("Endpoint is required.")
  .trim()
  .min(1, "Endpoint is required.")
  .refine((value) => /^https?:\/\/[^\s/]+/.test(value), "Enter a URL such as https://s3.eu-west-1.amazonaws.com.");

export const createStorageTargetSchema = z.object({
  name: z.string("Name is required.").trim().min(1, "Name is required."),
  endpoint,
  region: z.string().nullable().optional(),
  bucket: z.string("Bucket is required.").trim().min(1, "Bucket is required."),
  prefix: z.string().nullable().optional(),
  path_style: z.boolean().default(false),
  access_key_id: z.string("Access key ID is required.").trim().min(1, "Access key ID is required."),
  secret_access_key: z.string("Secret key is required.").trim().min(1, "Secret key is required."),
  organization_ids: z.array(z.coerce.number()).default([]),
  enabled: z.boolean().default(false),
});

// The location can't change once saved, and an empty secret keeps the stored one.
export const updateStorageTargetSchema = z.object({
  name: z.string("Name is required.").trim().min(1, "Name is required."),
  path_style: z.boolean().default(false),
  access_key_id: z.string("Access key ID is required.").trim().min(1, "Access key ID is required."),
  secret_access_key: z.string().nullable().optional(),
  organization_ids: z.array(z.coerce.number()).default([]),
  enabled: z.boolean().default(false),
});
