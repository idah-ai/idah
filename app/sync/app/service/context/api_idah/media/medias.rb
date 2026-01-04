module Context
  module ApiIdah
    module Media
      class Medias < Base
        def builder(media)
          Unit.new(
            super(media)
          )
        end

        def initialize(args = nil, context_filters = nil, opts = nil, context_api = nil)
          # Dependency injection: allow passing context_api for testing
          context_api ||= Api[:idah].media.medias

          super(
            context_api,
            args,
            context_filters,
            opts
          )
        end

        def resource_info(filters = {})
          merged = build_filters(filters)

          unless merged[:resource]
            raise Context::Error::InvalidData, "resource parameter is required"
          end

          media_response = @api.resource_info(resource: merged[:resource])
          raise Context::Error::QueryFailed, media_response.errors if media_response.errors

          builder(media_response.data)
        end

        def files(filters = {})
          merged = build_filters(filters)

          unless merged[:resource]
            raise Context::Error::InvalidData, "resource parameter is required"
          end

          builder(@api.files(resource: merged[:resource]))
        end
      end
    end
  end
end