# frozen_string_literal: true
module Export
  class Job < Jobs::Base
    def run_impl
      begin
        puts arguments.fetch(:auth_context)
        ios = []
        io_classes = Hash(arguments.fetch(:io_classes)).map do |io_type, io_class|
          [io_type, Verse::Util::Reflection.constantize(io_class)]
        end.to_h
        process_classes = Hash(arguments.fetch(:process_classes)).map do |process_type, process_class|
          [process_type, Verse::Util::Reflection.constantize(process_class)]
        end.to_h
        process_classes.each do |process_name, process|
          io = io_classes[process_name]&.prepare(arguments.fetch(:io_args))
          raise "no io to process #{process_name} ?" unless io
          ios << io
          process.new(
            Context::root(
              io,
              arguments.fetch(:filters)
            )
          ).run # arguments.fetch(:process_args) # or init ? or both ?
        end
      ensure
        remaining_stderr = []
        completion = []
        ios.each do |io|
          io.i.close if io&.i && !io.i.closed?
          if (io&.e && io&.wait_thr)
            remaining_stderr << line while (line = io.e.gets)
            value = io.wait_thr.value
            if value.exitstatus != 0
              raise "#{io.name} error #{value}\n#{remaining_stderr.join}"
            end
          end
          io.o.close if io&.o && !io.o.closed?
          io.e.close if io&.e && !io.e.closed?
          completion << "#{io.name} process complete"
        end
        Verse::logger.info { completion.join('\n') }
      end
    end
  end
end
