module Context
  module ContextApi
    class Medias < Crud
      def initialize(context_filters, args, api = Api[:idah])
        super(
          proc do |medias|
            medias
          end, api.media.medias, context_filters, args, api)
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
