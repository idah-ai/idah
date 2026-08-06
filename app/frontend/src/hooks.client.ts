import * as Sentry from "@sentry/sveltekit";

import { authStatus } from "@/security/AuthContext";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 1.0),
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  // Backend calls go to `${VITE_IDAH_HOST}/api/v1/<service>` through nginx;
  // matching them attaches sentry-trace/baggage headers so backend traces
  // continue the browser trace.
  tracePropagationTargets: [/^\/api\//, import.meta.env.VITE_IDAH_HOST].filter(Boolean),

  // Session replay: sample a slice of normal sessions, keep every errored one.
  replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE ?? 0.1),
  replaysOnErrorSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE ?? 1.0),
});

// Attach the signed-in account to every event and replay; clear it on logout.
authStatus.subscribe((login) => {
  if (login.status === "logged-in" && login.authContext) {
    const user = login.authContext;

    Sentry.setUser({ id: user.id, email: user.email });
    Sentry.setTag("account_role", user.roleName);
  } else if (login.status === "logged-out") {
    Sentry.setUser(null);
    Sentry.setTag("account_role", undefined);
  }
});

export const handleError = Sentry.handleErrorWithSentry();
