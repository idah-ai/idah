module Context
  module Io
    Context = Data.define(:io) do
      def name
        "io"
      end

      def method_missing(name, *args, &block)
        if io.respond_to?(name)
          io.send(name, *args, &block)
        else
          super
        end
      end

      def respond_to_missing?(name, include_private = false)
        io.respond_to?(name) || super
      end
    end
    def self.new(args = {})
      classname = Hash(args).fetch(:klass)
      return unless classname

      Context.new(Verse::Util::Reflection.constantize(classname).new)
    end
  end
end