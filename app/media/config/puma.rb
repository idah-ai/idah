# frozen_string_literal: true

workers ENV.fetch("PUMA_WORKERS", 2).to_i

# For medias, we use a higher number of threads to handle
# more concurrent requests.
threads(*([ENV.fetch("PUMA_THREADS", 16).to_i] * 2))

port ENV.fetch("PORT", 3000)
environment ENV.fetch("APP_ENVIRONMENT", "development")

before_fork do
  GC.start
  GC.compact
end

on_worker_boot do
  # Reconnect to the event manager
  Verse.event_manager.restart

  ::SCHEDULER.start
  ::EXECUTOR.start
end

preload_app!
