# frozen_string_literal: true

require "monitor"

module Jobs
  class Scheduler < Verse::Service::Base
    include MonitorMixin

    use jobs: JobRepository

    def initialize
      super Verse::Auth::Context.new # Use system context

      @wait_cond = new_cond

      @thread_pool = Jobs::ThreadPool.new(
        size: Verse.config.extra_field.dig(:jobs, :concurrency) || 4
      )
      @scheduler = Thread.new(&method(:run))

      @stop = false
    end

    def run
      loop do
        # Check for jobs available
        Verse.debug "Checking for jobs to run"

        # Pull more job if a thread is free.
        if @thread_pool.free > 0
          job = jobs.lock_available(@thread_pool.free)
          # Process the job:
          process(job) if job
        end

        # Check scheduled jobs
        time = jobs.next_scheduled_time
        next_in = time.to_i - Time.now.to_i

        break if @stop

        synchronize do
          if next_in.nil? # No scheduled jobs, wait 10s
            @wait_cond.wait(10)
          elsif next_in > 0 # Scheduled job is ready, process immediately
            @wait_cond.wait(next_in) if next_in > 0
          end
        end
      end
    end

    def stop
      @stop = true
      synchronize do
        @wait_cond.signal # Wake up the thread if it's waiting
        @scheduler.join # Wait for the scheduler thread to finish
        @thread_pool.stop # Stop the thread pool
        Verse.debug "Scheduler stopped"
      end
    end

    # On event, signal to stop waiting to try
    # to get the next job
    def signal
      synchronize do
        @wait_cond.signal
      end
    end
  end
end
