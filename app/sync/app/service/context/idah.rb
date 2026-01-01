module Context
  class Idah < Root
    IDAH_APIS = [
      IdahApi::Organizations,
      IdahApi::Projects,
      IdahApi::ProjectMembers,
      IdahApi::Datasets,
      IdahApi::Entries,
      IdahApi::Annotations
    ]

    def initialize(args = {}, context = {}, opts = {})
      args = Hash(args)
      context = Hash(context)
      filters = (args.keys + context.keys).uniq # for now (let finalize authentication and see)

      Verse::logger.debug({filters:})
      # Validate that all IDAH_APIS are valid Context classes
      IDAH_APIS.each do |api_class|
        Verse::logger::debug {{API_CHECK: api_class}}
        unless api_class < Base
          raise Context::Error::InvalidContext, api_class
        end
      end

      # Find the matching API based on filter keys, or initialize all APIs
      matched_api = IDAH_APIS.find do |idah_context|
        Verse::logger::debug {{name:idah_context.name, filters:}}
        filters.include?(idah_context.name)
      end
      Verse::logger.debug{{matched_api:}}
      context_apis = if matched_api
        matched_api.idah_apis(args, context, opts)
      else
        # Default to all
        IDAH_APIS.map do |idah_api|
          idah_api.new(args, context, opts)
        end
      end

      Verse::logger.debug({context_apis:})
      super(context_apis)
    end
  end
end
