module Context
  class Base
    attr_reader :context_filters, :args, :opts
    def name
      self.class
        .name.split("::").last
        .gsub(/(?<=[a-z])(?=[A-Z])/, '_')
        .downcase
        .to_sym
    end

    def initialize(
      context_api,
      args = {},
      context_filters = {},
      opts = {},
      context_builder = Proc.new {|record| record}
    )
      @args = args
      @context_api = context_api
      @context_builder = context_builder
      @context_filters = context_filters
      @opts = opts
      Verse::logger.debug {[:init_context, self.name, self].join(' ')}
    end

    protected
    def merge_filters(filters = {}, context_api_name = @context_api.name)
      Hash(filters)
        .merge(Hash(Hash(@context_filters)[context_api_name]))
        .merge(Hash(Hash(@args)[context_api_name]))
    end

    def merge_context_filters(filters = {}, context_api_name = @context_api.name)
      Hash(@context_filters).merge([[context_api_name, merge_filters(filters, context_api_name)]].to_h)
    end
  end
end
