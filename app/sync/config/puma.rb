# frozen_string_literal: true

puma_workers = ENV.fetch("PUMA_WORKERS", 1).to_i
ENV["PUMA_WORKERS"] = puma_workers.to_s

if puma_workers <= 1
  workers 0
else
  workers puma_workers

  before_fork do
    GC.start
    GC.compact
  end

  on_worker_boot do
    # Reconnect to the event manager
    Verse.event_manager.restart
  end
end

puma_threads = ENV.fetch("PUMA_THREADS", 16).to_i

threads puma_threads, puma_threads

port ENV.fetch("PORT", 3000)
environment ENV.fetch("APP_ENVIRONMENT", "development")

preload_app!
