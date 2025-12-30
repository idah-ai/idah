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

    def initialize(args = {}, context = {}, _opts = {})
      args = Hash(args)
      context = Hash(context)
      filters = args.keys
      super(
        Root.new(
          IDAH_APIS.find do |idah_context|
            filters.include?(idah_context.name)
          end&.idah_apis(args, context, opts) || IDAH_APIS.map do |idah_context|
            idah_context.new(args, context, opts)
          end
        )
      )
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
