module Context
  class Io < Base
    def initialize(args = {}, context = {})
      klass = Verse::Util::Reflection.constantize(Hash(context).fetch(:klass))

      # raise "Invalid Io class #{klass.class}" unless klass.class < ExecutorCommand
      super(klass.new(args, context))
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
