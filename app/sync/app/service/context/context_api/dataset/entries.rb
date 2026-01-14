module Context
  module ContextApi
    module Dataset
      class Entries < Base
        def builder(entries)
          super_entries = super(entries)
          return unless super_entries

          super_entries.lazy.map do |entry|
            id = entry.dig(:id)
            unless id
              raise Context::Error::InvalidData, "Entry missing id"
            end

            resource = entry.dig(:attributes, :resource)
            unless resource
              raise Context::Error::InvalidData, "Entry missing resource in attributes"
            end

            filters = build_context_args({
              entries: {id:, resource:},
              medias: {resource:},
              annotations: { entry_id: id }
            })
            Unit.new(
              entry, [
                ContextApi::Media::Medias.new(@args, filters, **@opts),
                Annotations.new(@args, filters, **@opts)
              ], @args, filters, **@opts
            )
          end
        end

        def initialize(
          args = nil,
          context_args = nil,
          delegated_obj = nil,
          **opts,
          &context_builder
        )
          super(
            delegated_obj || Api[:idah].dataset.entries,
            args,
            context_args,
            **opts,
            &context_builder
          )
        end
      end
    end
  end
end
