import * as Sentry from "@sentry/sveltekit";
import { sequence } from "@sveltejs/kit/hooks";

import { env } from "$env/dynamic/public";

Sentry.init({
  dsn: env.PUBLIC_SENTRY_DSN,
  environment: env.PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  tracesSampleRate: Number(env.PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 1.0),
});

// Compose future server hooks inside `sequence`, after `sentryHandle()`.
export const handle = sequence(Sentry.sentryHandle());
export const handleError = Sentry.handleErrorWithSentry();
