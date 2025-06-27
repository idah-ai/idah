# frozen_string_literal: true

require "monitor"

module Jobs
  class Scheduler < Verse::Service::Base
    class << self
      attr_accessor :instance
    end

    include MonitorMixin

    use jobs: Jobs::Repository

    def initialize
      super Verse::Auth::Context.new # Use system context

      self.class.instance ||= self
      @wait_cond = new_cond
      @running = false
    end

    def running
      synchronize do
        @running
      end
    end

    def start
      stop if running

      synchronize{ @running = true }

      @thread_pool = Jobs::ThreadPool.new(
        size: Verse.config.extra_fields.dig(:jobs, :concurrency) || 4
      )

      @scheduler = Thread.new(&method(:run))
    end

    def run
      loop do
        break unless running

        # Check for jobs available
        Verse.logger&.debug "Checking for jobs to run"

        # Pull more job if a thread is free.
        free = @thread_pool.free
        if free > 0
          Verse.logger&.debug "Thread pool has #{free} free threads"
          available_jobs = jobs.lock_available(free)
          available_jobs.each(&method(:process))
        end

        # Check scheduled jobs
        time = jobs.next_scheduled_time

        synchronize do
          if time.nil?
            Verse.logger&.debug "No scheduled jobs found. Waiting 10s"
            @wait_cond.wait(10) # Wait for 10 seconds if no jobs are scheduled
          else
            next_in = time.to_f - Time.now.to_f

            if next_in <= 0
              Verse.logger&.debug "Next scheduled job is ready to run"
            else
              Verse.logger&.debug "Next scheduled job in #{next_in} seconds"
              # Wait until the next scheduled job is ready
              @wait_cond.wait(next_in)
            end
          end
        end
      end
    end

    def process(job)
      klass = Verse::Util::Reflection.constantize(job.job_class)

      # Security in case of database poisoning,
      # to avoid running arbitrary code
      unless klass < Jobs::Base
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
      return unless running # Already stopped

      synchronize do
        @running = false
        @wait_cond.signal # Wake up the thread if it's waiting
      end

      @thread_pool.stop # Stop the thread pool

      @scheduler.join # Wait for the scheduler thread to finish

      Verse.logger&.debug "Scheduler stopped"
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
