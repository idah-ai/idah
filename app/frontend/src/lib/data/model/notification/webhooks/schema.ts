import { z } from "zod";

export const webhookSchema = z.object({
  name: z.string("Webhook name is required.").min(3, "Webhook name must be at least 3 characters."),
  url: z.string("Webhook URL is required.").url("Webhook URL must be a valid URL."),
  events: z.array(z.string().min(3)).min(1, "Select at least one event type."),
  enabled: z.boolean(),
  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

export const createWebhookSchema = webhookSchema.pick({
  name: true,
  url: true,
  events: true,
  enabled: true,
});

export const updateWebhookSchema = createWebhookSchema;
