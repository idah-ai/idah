module Context
  module Idah
    module Media
      class Medias < Base
        def initialize(args = nil, context_filters = nil, opts = nil, context_api = nil)
          super(
            context_api || Api[:idah].media.medias,
            args,
            context_filters,
            opts
          )
        end

        def resource_info(filters = nil, opts = nil)
          merged = build_filters(filters)

          unless merged[:resource]
            raise Context::Error::InvalidData, "resource parameter is required"
          end

          media_response = super(resource: merged[:resource])
          raise Context::Error::QueryFailed, media_response.errors if media_response.errors

          media_response.data
        end

        def files(filters = nil, opts = nil)
          merged = build_filters(filters)

          unless merged[:resource]
            raise Context::Error::InvalidData, "resource parameter is required"
          end

          super(resource: merged[:resource])
        end
      end
    end
  end
end