import { z } from "zod";

export const webhookSchema = z.object({
  name: z.string("Webhook name is required.").min(3, "Webhook name must be at least 3 characters."),
  url: z.string("Webhook URL is required.").url("Webhook URL must be a valid URL."),
  event_types: z.array(z.string().min(3)).min(1, "Select at least one event type."),
  secret_key: z.string("Secret key is required.").min(3, "Secret key must be at least 3 characters."),
  enabled: z.boolean(),
  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

export const createWebhookSchema = webhookSchema.pick({
  name: true,
  url: true,
  event_types: true,
  secret_key: true,
  enabled: true,
});

export const updateWebhookSchema = createWebhookSchema.pick({
  name: true,
  url: true,
  event_types: true,
  secret_key: true,
  enabled: true,
});
