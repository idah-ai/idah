module Context
  class Io < Base
    def initialize(args = nil, context = nil, opts = nil)
      classname = Hash(opts)[:klass]
      unless classname
        raise Context::Error::InvalidContext, :missing_io_klass
      end

      klass = Verse::Util::Reflection.constantize(classname)
      unless klass && klass < IoContext::Base
        raise Context::Error::InvalidContext, [:invalid_io_class, klass].join(":")
      end

      super(klass.new(args, context, opts), args, context, opts)
    end
  end
end
