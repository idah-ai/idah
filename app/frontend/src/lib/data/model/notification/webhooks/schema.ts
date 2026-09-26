import { z } from "zod";

export const webhookSchema = z.object({
  name: z.string("Webhook name is required.").min(3, "Webhook name must be at least 3 characters."),
  url: z.string("Webhook URL is required.").url("Webhook URL must be a valid URL."),
  event_type: z.string("Event type is required.").min(3, "Event type must be at least 3 characters."),
  secret_key: z.string("Secret key is required.").min(3, "Secret key must be at least 3 characters."),
  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

export const createWebhookSchema = webhookSchema.pick({
  name: true,
  url: true,
  event_type: true,
  secret_key: true,
});

export const updateWebhookSchema = createWebhookSchema.pick({
  name: true,
  url: true,
  event_type: true,
  secret_key: true,
});
