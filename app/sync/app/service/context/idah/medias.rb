module Context
  module Idah
    class Medias < Base
      def initialize(args = {}, context_filters = {})
        super(
          Api[:idah].media.medias,
          args,
          context_filters
        )
      end

      def resource_info(filters = {})
        media_response = @context_api.resource_info(
          resource: merge_filters(filters)[:resource]
        ) # ? seems loose
        raise media_response.errors if media_response.errors

        media_response.data
      end

      def files(filters = {})
        @context_api.files(resource: merge_filters(filters)[:resource]) # to do stream
      end
    end
  end
end
