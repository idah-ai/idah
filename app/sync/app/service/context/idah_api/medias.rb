module Context
  module IdahApi
    class Medias < Base
      def initialize(args = {}, context_filters = {}, context_api = Api[:idah].media.medias)
        super(
          context_api,
          args,
          context_filters
        )
      end

      def resource_info(filters = {})
        media_response = @context_api.resource_info(
          resource: build_filters(filters)[:resource]
        ) # ? seems loose
        raise media_response.errors if media_response.errors

        media_response.data
      end

      def files(filters = {})
        @context_api.files(resource: build_filters(filters)[:resource]) # to do stream
      end
    end
  end
end
