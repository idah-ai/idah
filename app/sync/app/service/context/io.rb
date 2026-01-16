module Context
  class Io < Base
    def initialize(io_class, args = nil, context = nil, **opts)
      unless io_class < Command::Base
        raise Context::Error::InvalidContext, [:invalid_io_delegate, io_class].join(":")
      end

      io_instance = io_class.new(**opts.slice(:name))
      io_opts = build_context_opts({io: opts})
      super(io_instance, args, context, **io_opts)
    end
  end
end
