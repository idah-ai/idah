module Context
  module ContextApi
    module Dataset
      class Annotations < Base
        def builder(annotations)
          super(annotations)&.map do |annotation|
            id = annotation.dig(:id)
            unless id
              raise Context::Error::InvalidData, "Annotation missing id"
            end

            annotation
          end
        end

        def initialize(
          args = nil,
          context_args = nil,
          opts = nil,
          delegated_obj = nil,
          &context_builder
        )
          super(
            delegated_obj || Api[:idah].dataset.annotations,
            args,
            context_args,
            opts,
            &context_builder
          )
        end
      end
    end
  end
end
