module Context
  module IdahApi
    class Medias < Base
      def initialize(args = {}, context_filters = {}, opts = {}, context_api = nil)
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
          raise Sync::Error::InvalidData, "resource parameter is required"
        end

        media_response = @context_api.resource_info(resource: merged[:resource])
        raise Sync::Error::QueryFailed, media_response.errors if media_response.errors

        media_response.data
      end

      def files(filters = {})
        merged = build_filters(filters)

        unless merged[:resource]
          raise Sync::Error::InvalidData, "resource parameter is required"
        end

        @context_api.files(resource: merged[:resource])
      end
    end
  end
end
