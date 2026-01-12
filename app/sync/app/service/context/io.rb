module Context
  class Io < Base
    def initialize(args = nil, context = nil, **opts)
      classname = opts.dig(:klass)
      unless classname
        raise Context::Error::InvalidContext, :missing_io_klass
      end

      klass = Verse::Util::Reflection.constantize(classname)
      unless klass && klass < Command::Base
        raise Context::Error::InvalidContext, [:invalid_io_class, klass].join(":")
      end

      instance = klass.new(**opts)
      io_opts = build_context_opts({io: opts})
      super(instance, args, context, io_opts)
    end
  end
end
