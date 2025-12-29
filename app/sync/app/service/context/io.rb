module Context
  class Io < Base
    def initialize(args = {})
      classname = Hash(args).fetch(:klass)
      return unless classname

      super(Verse::Util::Reflection.constantize(classname).new)
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
