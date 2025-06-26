# frozen_string_literal: true

require "monitor"

module Jobs
  class Scheduler < Verse::Service::Base
    include MonitorMixin

    use jobs: Job::Repository

    def initialize
      super Verse::Auth::Context.new # Use system context

      @wait_cond = new_cond

      @thread_pool = Jobs::ThreadPool.new(
        size: Verse.config.extra_fields.dig(:jobs, :concurrency) || 4
      )
      @scheduler = Thread.new(&method(:run))

      @stop = false
    end

    def run
      loop do
        # Check for jobs available
        Verse.logger&.debug "Checking for jobs to run"

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

    def process(job)
      klass = Verse::Util::Reflection.constantize(job.job_class)

      # Security in case of database poisoning,
      # to avoid running arbitrary code
      unless klass.is_a?(Jobs::Base)
        raise "Job class #{job.job_class} is not a valid Jobs::Base subclass"
      end

      Verse.logger&.debug {
        "Processing job #{klass.name}:#{job.id} with arguments #{job.arguments.inspect[0..100]}"
      }

      @thread_pool.run do
        klass.new(job.arguments).run
      end
    end

    def stop
      @stop = true
      synchronize do
        @wait_cond.signal # Wake up the thread if it's waiting
        @scheduler.join # Wait for the scheduler thread to finish
        @thread_pool.stop # Stop the thread pool
        Verse.logger&.debug "Scheduler stopped"
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
