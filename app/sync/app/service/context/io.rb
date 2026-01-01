module Context
  class Io < Base
    def initialize(args = {}, context = {}, opts = {})
      klass = Verse::Util::Reflection.constantize(Hash(opts).fetch(:klass))

      # Note: Add validation here if ExecutorCommand interface is defined
      # raise Context::Error::InvalidContext, klass unless klass < ExecutorCommand

      super(klass.new(args, context, opts))
    end
  end
end
