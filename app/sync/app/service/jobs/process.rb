# frozen_string_literal: true
module Jobs
  class Process < Base
    # registry prep wip
    REGISTRY = {
      "UniversalPortableDataset": {
        export: Exports::UniversalPortableDataset
      },
      "Cvat": {
        export: Exports::Cvat
      },
    }

    def process_type
      raise NotImplementedError
    end

    def on_process_complete(process, context)
      raise NotImplementedError
    end

    def scoped(filters)
      args =
        case created_by_role
        when "admin"
          nil
        when "org_owner"
          { projects: { organization_id__in: [created_by_organization] }}
        when "user"
          raise NotImplementedError
        else
          raise "unexpected auth_context #{self}"
        end
      Context::Base.build_context_args(args, filters)
    end

    def run_impl
      opts = arguments.dig(:opts)
      arguments.fetch(:formats).each do |format, format_opts|
        process_registry = REGISTRY.fetch(format)
        process_class = process_registry.fetch(process_type)
        context = Context::Root.new([
          Context::Io.new(process_class.io), # opts
          Context::ContextApi.new(scoped(arguments.fetch(:filters)))
        ])
        process = process_class.new(context)
        begin
          process.run
        rescue Exception => e
          Verse::logger::error{[
            "#{self} Error while processing #{process}",
            [e, "#{e.backtrace.join("\n")}"].join("\n")
          ].join("\n")}
          raise e
        end

        context.each do |format_context|
          format_context.close if format_context.respond_to? :close
        end
        on_process_complete(process, context)
      end
    end
  end
end
