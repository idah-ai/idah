module Context
  module ContextApi
    class Base < CrudIterator
      WHITELIST = [
        Api::Exposition,
        Base,
        ProceduralCrud,
    ]

      def builder(unit)
        if __getobj__.class == Api::Exposition
          raise Error::QueryFailed, unit.errors if unit.errors

          unit.data.map(&:data).map do |data|
            super(data)
          end unless unit.data.empty?
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