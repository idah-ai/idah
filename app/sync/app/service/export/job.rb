# frozen_string_literal: true
module Export
  class Job < Jobs::Base
    def run_impl
      begin
        ios = []
        arguments.fetch(:io_classes).each do |_context_type, context_klass|
          ios << Verse::Util::Reflection.constantize(
            context_klass
          ).prepare(arguments.fetch(:io_args))
        end
        # TODO: multi process ?
        process_class = Verse::Util::Reflection.constantize(
          arguments.fetch(:process_class)
        )
        io = ios.find {|io| io.name == process_class.name}
        raise "#{self} error locating required #{process_class.name} io" unless io

        process_class.new(
          Context::root(io, arguments.fetch(:context_args)) # TODO use user AuthContext instead of service AuthContext
        ).run # arguments.fetch(:process_args) # or init ? or both ?
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
