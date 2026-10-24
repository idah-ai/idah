# frozen_string_literal: true

# Webhook delivery job scheduler. It only runs under puma (config/puma.rb sets
# PUMA_WORKERS): in single mode it starts on boot, otherwise each worker
# starts its own in before_worker_boot. Rake tasks and specs don't start it.
SCHEDULER = Jobs::Scheduler.new

Verse.on_stop do
  SCHEDULER.stop
end

if ENV["PUMA_WORKERS"] == "1"
  Verse.on_boot do
    SCHEDULER.start
  end
end
