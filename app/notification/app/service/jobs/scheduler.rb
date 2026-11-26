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

    # :nocov:
    def start
      stop if running

      synchronize{ @running = true }

      jobs.reclaim_stale

      @thread_pool = ThreadPool.new(
        size: Verse.config.extra_fields.dig(:idah, :jobs, :concurrency) || 4
      )

      @scheduler = Thread.new(&method(:run))
    end

    def run
      Thread.current.name = "#{self.class.name} (#{Thread.current.object_id})"

      Verse.logger&.debug "Starting scheduler with #{@thread_pool.size} threads"
      while running
        synchronize do
          # Pull more job if a thread is free.
          free = @thread_pool.free
          if free > 0
            Verse.logger&.debug "Job pooling (#{free} free threads)"
            available_jobs = jobs.lock_available(free)
            available_jobs.each { |job| @thread_pool.run { execute(job) } }
          end

          # Check scheduled jobs
          time = jobs.next_scheduled_time

          if time.nil?
            Verse.logger&.debug "No scheduled jobs found. Waiting 60s"
            @wait_cond.wait(60) # Wait for 60 seconds if no jobs are scheduled
          else
            next_in = time.to_f - Time.now.to_f

            if next_in > 0
              Verse.logger&.debug "Next scheduled job in #{next_in} seconds"
              # Wait until the next scheduled job is ready
              @wait_cond.wait(next_in)
            else
              # Wait a second, to avoid busy looping.
              @wait_cond.wait(1.0)
            end
          end
        end
      end
    end

    # :nocov:
    # Runs one job and records its outcome: completed, rescheduled with
    # exponential backoff while retries remain, or errored.
    def execute(job)
      klass = Verse::Util::Reflection.constantize(job.job_class)

      # Security in case of database poisoning,
      # to avoid running arbitrary code
      unless klass < Jobs::Base
        raise "Job class #{job.job_class} is not a valid Jobs::Base subclass"
      end

      catch :stop do
        Verse.logger&.info {
          "Processing job #{klass.name}:#{job.id} with arguments #{job.arguments.inspect[0..100]}"
        }
        klass.new(job.id, job.arguments).run do |command, **opts|
          case command
          when :error
            error = opts[:error]
            error_message = error.is_a?(String) ? error : "#{error.class}: #{error.message}"

            if job.retry_count < (klass.max_retries || 0)
              retry_delay = 5 * (2 ** (job.retry_count * 1.5)).to_i

              Verse.logger&.warn{
                "Job #{job.id} failed with error: #{error_message}. " \
                "Retrying in #{retry_delay} seconds (attempt #{job.retry_count + 1}/#{klass.max_retries})"
              }

              jobs.reschedule(job.id, scheduled_at: Time.now + retry_delay, error: error_message)
            else
              jobs.error(job.id, error_message)
              Verse.logger&.error{
                "Job #{job.id} failed with error: #{error_message}. " \
                "Max retries (#{klass.max_retries}) reached, marking as failed."
              }
            end

            throw :stop
          end
        end

        jobs.complete(job.id)
        Verse.logger&.debug "Job #{job.id} processed successfully"
      end
    rescue StandardError => e
      jobs.error(job.id, "#{e.class.name}: #{e.message}")
      raise e
    end

    # :nocov:
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

    # :nocov:
    # On event, signal to stop waiting to try
    # to get the next job
    def signal
      synchronize do
        @wait_cond.signal
      end
    end
  end
end
