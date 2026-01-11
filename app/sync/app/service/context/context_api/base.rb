module Context
  module ContextApi
    class Base < CrudEnumerator
      WHITELIST = [
        Api::Exposition,
        Base,
        CrudProcedural,
      ]

      def builder(unit)
        if unit.is_a? CrudProcedural
          unit.lazy.map do |data|
            super(data)
          end
        elsif unit.is_a?(Verse::JsonApi::Struct)
          raise Error::QueryFailed, unit.errors if unit.errors

          unit.data.lazy.map(&:data).lazy.map do |data|
            super(data)
          end unless unit.data.empty?
        elsif unit.is_a? Unit
          unit
        else
          super(unit)
        end
      end

      def initialize(
        api = Api[:idah],
        args = nil,
        context_args = nil,
        opts = nil,
        &context_builder
      )
        unless WHITELIST.any? {|whitelist| api.is_a? whitelist}
          raise Error::InvalidContext, self
        end

        super(api, args, context_args, opts)
      end

      def self.root_api(api, args = nil, context = nil, opts = nil)
        raise NotImplementedError
      end
    end
  end
end