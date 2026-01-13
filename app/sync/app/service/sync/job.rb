# frozen_string_literal: true
module Sync
  class Job < Jobs::Base
    def run_impl
      begin
        ios = []
        authcontext = arguments.fetch(:auth_context)
        role = authcontext.fetch(:role)
        custom_scopes = authcontext.fetch(:custom_scopes)

        auth_context_args = \
          case role
          when "admin"
            nil
          when "org_owner"
            { projects: {
              organization_id__in: Array(Hash(custom_scopes).fetch(:org))
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

        Hash(arguments.fetch(:processors)).lazy.map do |process_name, process_config|
          Verse::logger.debug {{process_name:, process_config:}}
          process_config = Hash(process_config)
          [
            processor_classes.fetch(process_config.fetch(:klass)),
            process_config.fetch(:context).map do |context_name, context_config|
              Verse::logger.debug {{context_name:, context_config:}}
              context_config = Hash(context_config)
              klass = context_classes[context_config.fetch(:klass)]
              Verse::logger.debug {{
                klass:,
                args: Context::Base.build_context_args(
                  auth_context_args,
                  context_config[:context]
                ),
                opts: context_config[:opts]
              }}
              klass.new(
                auth_context_args,
                **context_config[:opts]
              ) if klass
            end
          ]
        end.map do |process_class, contexts| # temp
          [process_class, Context::Root.new(contexts)]
        end.map do |process_class, context|
          [context, process_class.new(context)]
        end.map do |context, process|
          Verse::logger.debug {{running: process.class.name}}
          begin
            [context, process.class.name, process.run]
          rescue Exception => e
            Verse::logger::error{
              [
                "#{self} Error while processing #{process}",
                [e, "#{e.backtrace.join("\n")}"].join("\n")
              ].join("\n")
            }
            raise e
          end
        end.each do |context, process_name, success|
          Verse::logger.debug {{process_name:, success:}}
          context.each do |plugin_context|
            if plugin_context.respond_to? :close
              Verse::logger.debug {
                "closing: #{plugin_context} #{plugin_context.close}"
              }
            end
          end
        end
      end
    end
  end
end
