module Context
  class Idah < Base
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
      filters = args.keys

      # Validate that all IDAH_APIS are valid Context classes
      IDAH_APIS.each do |api_class|
        unless api_class < Base
          raise Sync::Error::InvalidContext, api_class
        end
      end

      # Find the matching API based on filter keys, or initialize all APIs
      matched_api = IDAH_APIS.find do |idah_context|
        filters.include?(idah_context.name)
      end

      context_apis = if matched_api
        matched_api.idah_apis(args, context, opts)
      else
        # Default to all
        IDAH_APIS.map do |idah_context|
          idah_context.new(args, context, opts)
        end
      end

      super(Root.new(context_apis))
    end

    def method_missing(name, *args, &block)
      if @context_api.respond_to?(name)
        @context_api.send(name, *args, &block)
      else
        super
      end
    end

    def respond_to_missing?(name, include_private = false)
      @context_api.respond_to?(name) || super
    end
  end
end
