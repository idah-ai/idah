# frozen_string_literal: true

workers ENV.fetch("PUMA_WORKERS", 2).to_i

threads *([ENV.fetch("PUMA_THREADS", 2).to_i]*2)

port ENV.fetch("PORT", 3000)
environment ENV.fetch("APP_ENVIRONMENT", "development")

before_fork do
  # Reconnect to the event manager
  Verse.event_manager.restart

  GC.start
  GC.compact
end

preload_app!
