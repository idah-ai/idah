# frozen_string_literal: true
module Sync
  class Job < Jobs::Base
    def run_impl
      begin
        ios = []
        authcontext = arguments.fetch(:auth_context)
        role = authcontext.fetch(:role)
        custom_scopes = authcontext.fetch(:custom_scopes)

        auth_context_filters = \
          case role
          when "admin"
            {}
          when "org_owner"
            { organizations: {
              id__in: Array(Hash(custom_scopes).fetch(:org))
            }}
          when "user"
            raise "todo"
          else
            raise "unexpected auth_context: #{authcontext}"
          end

        context_classes = Hash(arguments.fetch(:processors)).flat_map do |processor, opts|
          Hash(Hash(opts).fetch(:context)).map do |context_name, context_opts|
            context_opts.fetch(:klass)
          end
        end.uniq.compact.map do |context_class|
          [context_class, Verse::Util::Reflection.constantize(context_class)]
        end.to_h

        processor_classes = Hash(arguments.fetch(:processors)).map do |processor, opts|
          Hash(opts).fetch(:klass)
        end.uniq.compact.map do |processor_class|
          [processor_class, Verse::Util::Reflection.constantize(processor_class)]
        end.to_h

        Hash(arguments.fetch(:processors)).lazy.map do |process_name, process|
          Verse::logger.debug {{process_name:, process:}}
          [
            processor_classes.fetch(process.fetch(:klass)),
            Hash(process).fetch(:context).map do |context_name, context|
              Verse::logger.debug {{context_name:, context:}}
              klass = context_classes[Hash(context).fetch(:klass)]
              Verse::logger.debug {{klass:}}
              Verse::logger.debug {{parameters: klass.instance_method(:initialize).parameters}}
              Verse::logger.debug {{
                args: Hash(auth_context_filters),
                context: Hash(context)[:context],
                opts: Hash(context)[:opts]
              }}
              klass.new(
                Hash(auth_context_filters),
                Hash(context)[:context],
                Hash(context)[:opts]
              ) if klass
            end
          ]
        end.map do |process_class, contexts| # temp
          io = contexts.find { |c| c.name == "io"}
          ios << io if io # TODO: proper release
          [process_class, Context.new(contexts)]
        end.map do |process_class, context|
          process_class.new(context)
        end.map do |process|
          Verse::logger::debug {{running: process.class.name}}
          [process.class.name, process.run]
        end.each do |name, run|
          Verse::logger::debug {{name:, run:}}
          # TODO on processes complete
        end
      ensure
        remaining_stderr = []
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
        end
      end
    end
  end
end
