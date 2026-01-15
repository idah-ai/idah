# frozen_string_literal: true
module Jobs
  class Process < Base
    # registry prep wip
    EXPORTS = [
      Exports::UniversalPortableDataset,
      Exports::Cvat
    ]
    IMPORTS = []
    PROCESSORS = (IMPORTS | EXPORTS).map {|p| [p.to_s, p]}.to_h
    CONTEXTS = [
      Context::ContextApi,
      Context::Io
    ].map {|p| [p.to_s, p]}.to_h
    COMMANDS = [
      Command::UniversalPortableDataset,
      Command::Cvat
    ].map {|p| [p.to_s, p]}.to_h

    def on_process_complete(process, context)
      raise NotImplementedError
    end

    def run_impl
      begin
        auth_context_args =
          case created_by_role
          when "admin"
            nil
          when "org_owner"
            { projects: { organization_id__in: [created_by_organization] }}
          when "user"
            raise "todo"
          else
            raise "unexpected auth_context #{self}"
          end

          Hash(arguments.fetch(:processors)).lazy.map do |process_name, process_config|
          process_config = Hash(process_config)
          process_class = PROCESSORS[process_config.fetch(:klass)]
          raise "#{process_name} is missing klass" unless process_class
          [
            process_class,
            process_config.fetch(:context).map do |context_name, context_config|
              context_config = Hash(context_config)
              context_class = CONTEXTS[context_config.fetch(:klass)]
              raise "#{context_name} is missing klass" unless context_class

              built_args = Context::Base.build_context_args(
                auth_context_args,
                context_config[:context]
              )
              context_class.new(built_args, **context_config[:opts])
            end
          ]
        end.map do |process_class, contexts| # temp
          [process_class, Context::Root.new(contexts)]
        end.map do |process_class, context|
          [context, process_class.new(context)]
        end.map do |context, process|
          begin
            [context, process, process.run]
          rescue Exception => e
            Verse::logger::error{
              [
                "#{self} Error while processing #{process}",
                [e, "#{e.backtrace.join("\n")}"].join("\n")
              ].join("\n")
            }
            raise e
          end
        end.map do |context, process, success|
          context.each do |plugin_context|
            plugin_context.close if plugin_context.respond_to? :close
          end
          [process, context]
        end.each do |process, context|
          on_process_complete(process, context)
        end
      end
    end
  end
end
