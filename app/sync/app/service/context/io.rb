module Context
  class Io < Base
    def initialize(args = nil, context = nil, opts = nil)
      classname = Hash(opts)[:klass]
      klass = Verse::Util::Reflection.constantize(classname) if classname

      raise Context::Error::InvalidContext, classname unless klass < IoContext::Base

      super(klass&.new(args, context, opts), args, context, opts)
    end

    def method_missing(s, *args, &block)
      @context_api.send(s, *args, &block)
    end
  end
end
