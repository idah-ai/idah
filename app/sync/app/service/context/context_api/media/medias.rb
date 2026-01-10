module Context
  module ContextApi
    module Media
      class Medias < Base
        def initialize(args = nil, context_args = nil, opts = nil, delegated_obj = nil)
          super(
            delegated_obj || Api[:idah].media.medias,
            args,
            context_args,
            opts
          )
        end

        def resource_info(filters = nil, opts = nil)
          resource = Hash(build_filters(filters))[:resource]
          unless resource
            raise Context::Error::InvalidData, "resource parameter is required"
          end

          media_response = __getobj__.resource_info(resource:)
          raise Context::Error::QueryFailed, media_response.errors if media_response.errors

          media_response.data
        end

        def files(filters = nil, opts = nil)
          merged = build_filters(filters)

          unless merged[:resource]
            raise Context::Error::InvalidData, "resource parameter is required"
          end

          __getobj__.files(resource: merged[:resource])
        end
      end
    end
  end
end