# frozen_string_literal: true
module Export
  class Job < Jobs::Base
    def run_impl

      begin
        ios = []
        arguments.fetch(:io_classes).each do |io_class|
          ios << Verse::Util::Reflection.constantize(
            io_class
          ).prepare(arguments.fetch(:io_args))
        end

        Verse::Util::Reflection.constantize(
          arguments.fetch(:process_class)
          ).new(
            Context::root(ios, arguments.fetch(:context_args))
          ).run # arguments.fetch(:process_args) # or init ? or both ?
      ensure
        # Cleanup all resources
        remaining_stderr = []
        completion = []
        ios.each do |io|
          io.i.close unless io.i.closed?
          io.o.close unless io.o.closed?
          io.e.close unless io.e.closed?

          remaining_stderr << line while (line = io.e.gets)
          value = io.wait_thr.value
          if value.exitstatus != 0
            raise "#{io.name} error #{value}\n#{remaining_stderr.join}"
          end
          completion << "#{io.name} process complete"
        end
        Verse::logger.info { completion.join('\n') }
      end
    end
  end
end
