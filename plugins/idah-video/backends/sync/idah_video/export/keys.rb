# frozen_string_literal: true

module IdahVideo
  module Export
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

      # String keys, for formats such as YAML that would write symbols as ":key".
      def stringify(value)
        case value
        when Hash then value.to_h { |k, v| [k.to_s, stringify(v)] }
        when Array then value.map { |v| stringify(v) }
        else value
        end
      end
    end
  end
end
