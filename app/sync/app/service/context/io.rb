module Context
  class Io < Base
    def initialize(args = nil, context = nil, opts = nil)
      classname = Hash(opts)[:klass]
      unless classname
        raise Context::Error::InvalidContext, :missing_io_klass
      end

      klass = Verse::Util::Reflection.constantize(classname)
      unless klass && klass < Command::Base
        raise Context::Error::InvalidContext, [:invalid_io_class, klass].join(":")
      end

      io_opts = self.class.build_opts(nil, opts)
      super(klass.new(opts), args, context, io_opts)
    end
  end
end
