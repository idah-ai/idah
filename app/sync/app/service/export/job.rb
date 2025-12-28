# frozen_string_literal: true
module Export
  class Job < Jobs::Base
    def run_impl
      begin
        puts arguments.fetch(:auth_context)
        ios = []

        context_classes = Hash(arguments.fetch(:processors)).flat_map do |processor, opts|
          Hash(Hash(opts).fetch(:context)).map do |context_name, context_opts|
            context_opts.fetch(:klass)
          end
        end.uniq.compact.map do|context_class|
          [context_class, Verse::Util::Reflection.constantize(context_class)]
        end.to_h

        processor_classes = Hash(arguments.fetch(:processors)).flat_map do |processor, opts|
          Hash(opts).fetch(:klass)
        end.uniq.compact.map do|processor_class|
          [processor_class, Verse::Util::Reflection.constantize(processor_class)]
        end.to_h

        Hash(arguments.fetch(:processors)).flat_map do |processor_name, processor_opts|
          classname = processor_opts.fetch(:klass)

          raise "missing processor klass" unless classname

          root_context = Context.new(
            Hash(processor_opts).fetch(:context).map do |context_name, context_opts|
              context = context_classes[Hash(context_opts).fetch(:klass)]&.new(
                Hash(context_opts)[:args]
              )
              ios << context if context_name == "io" # TODO 🤷: proper release
              context
            end
          )

          processor_classes[classname]&.new(root_context).run
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
