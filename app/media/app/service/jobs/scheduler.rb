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

      @thread_pool = ThreadPool.new(
        size: Verse.config.extra_fields.dig(:jobs, :concurrency) || 4
      )

      @scheduler = Thread.new(&method(:run))
    end

    def run
      Thread.current.name = "#{self.class.name} (#{Thread.current.object_id})"

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
        catch :stop do
          klass.new(job.id, job.arguments).run do |command, **opts|
            case command
            when :update_progress
              jobs.update_progress(job.id, opts[:value])
            when :reschedule
              reschedule_in = Time.now + opts.fetch(:in, 10) # Default to 10 seconds if not provided
              jobs.reschedule(job.id, "pending", scheduled_at: reschedule_in)
              throw :stop # Stop processing this job, it will be retried
            when :error
              error = opts[:error]

              error_message = \
                if error.is_a?(String)
                  error
                else
                  "#{error.class} - #{error.message}"
                end

              if job.retry_count < job.class.max_retries
                # Exponential backoff
                retry_delay = 5 * (2 ** (job.retry_count * 1.5)).to_i

                jobs.reschedule(
                  job.id,
                  scheduled_at: Time.now + retry_delay,
                  error: error_message
                )
              else
                jobs.error(job.id, error: error_message)
                Verse.logger&.error "Job #{job.id} failed after #{job.retry_count}"
              end

              throw :stop
            end
          end

          # If we reach here, the job has been processed successfully
          jobs.update_progress(job.id, 1.0)
          Verse.logger&.debug "Job #{job.id} processed successfully"
        end
      rescue StandardError => e
        jobs.update_progress(job.id, 0.0)
        raise e
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
