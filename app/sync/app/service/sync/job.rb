# frozen_string_literal: true
module Sync
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

        processor_classes = Hash(arguments.fetch(:processors)).map do |processor, opts|
          Hash(opts).fetch(:klass)
        end.uniq.compact.map do|processor_class|
          [processor_class, Verse::Util::Reflection.constantize(processor_class)]
        end.to_h

        Hash(arguments.fetch(:processors)).lazy.map do |processor_name, processor_opts|
          [
            processor_classes.fetch(processor_opts.fetch(:klass)),
            Hash(processor_opts).fetch(:context).map do |_context_name, context_opts|
              context_classes[Hash(context_opts).fetch(:klass)]&.new(
                Hash(context_opts)[:args]
              )
            end
          ]
        end.map do |process_class, contexts| # temp
          io = contexts.find { |c| c.name == "io"}
          ios << io if io # TODO: proper release
          [process_class, Context.new(contexts)]
        end.map do |process_class, context|
          process_class.new(context)
        end.map do |process|
          [process.class.name, process.run]
        end.each do |name, run|
          Verse::logger::debug {{name:, run:}}
          # TODO on processes complete
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
