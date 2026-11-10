# frozen_string_literal: true

module IdahImage
  module Export
    module Helpers
      # Data from the API arrives with symbol or string keys depending on how it
      # was parsed; the exporter reads everything with symbol keys.
      module Keys
        extend self

        def symbolize(value)
          case value
          when Hash then value.to_h { |k, v| [k.to_sym, symbolize(v)] }
          when Array then value.map { |v| symbolize(v) }
          else value
          end
        end
      end
    end
  end
end
