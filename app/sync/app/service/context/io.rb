module Context
  module Io
    def self.new(args = nil, context = nil, opts = nil)
      classname = Hash(opts)[:klass]
      unless classname
        raise Context::Error::InvalidContext, :missing_io_klass
      end

      klass = Verse::Util::Reflection.constantize(classname)
      unless klass && klass < Base
        raise Context::Error::InvalidContext, [:invalid_io_class, klass].join(":")
      end

      klass.new(args, context, opts)
    end
  end
end
