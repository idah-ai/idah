module Context
  class Io < Base
    def initialize(args = {}, context = {}, opts = {})
      classname = Hash(opts)[:klass]
      klass = Verse::Util::Reflection.constantize(classname) if classname

      raise Context::Error::InvalidContext, classname unless klass < IoContext::Base

      @io = klass&.new(args, context, opts)
      super(@io)
    end

      def method_missing(s, *args, &block)
        @io.send(s, *args, &block)
      end

      def respond_to_missing?(s, include_private = false)
        @io.respond_to?(s, include_private) || super
      end

  end
end
