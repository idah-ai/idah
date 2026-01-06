module Context
  module Idah
    class Base < CrudIterator
      def builder(unit)
        if @context_api.class == Api::Exposition
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
        args = {},
        context_filters = {},
        opts = {},
        &context_builder
      )
        unless [
          Api::Exposition,
          Idah::Base,
          ProceduralCrud,
        ].any? {|whitelist| api.is_a? whitelist}
          raise Error::InvalidContext, self
        end

        super(api, args, context_filters, opts)
      end

      def self.root_api(api, args = {}, context = {}, opts = {})
        Verse::logger.debug {{root_api: api, args:, context:, opts:}}
        unless api.class < Base
          raise Context::Error::InvalidContext, api.class
        end
        api
      end
    end
  end
end