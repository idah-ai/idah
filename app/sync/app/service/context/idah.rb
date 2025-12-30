module Context
  class Idah < Base
    API = Data.define(:name, :api)

    IDAH_CONTEXTS = [
      IdahContext::Organizations,
      IdahContext::Projects,
      IdahContext::ProjectMembers,
      IdahContext::Datasets,
      IdahContext::Entries,
      IdahContext::Annotations
    ]

    def initialize(args = {}, context = {})
      args = Hash(args)
      context = Hash(context)
      filters = args.keys
      super(
        Root.new(
          IDAH_CONTEXTS.find do |idah_context|
            filters.include?(idah_context.name)
          end&.idah(args, context) || IDAH_CONTEXTS.map do |idah_context|
            idah_context.new(args, context)
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
