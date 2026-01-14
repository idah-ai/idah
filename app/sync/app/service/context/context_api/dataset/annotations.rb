module Context
  module ContextApi
    module Dataset
      class Annotations < Base
        def builder(annotations)
          super_annotations = super(annotations)
          return unless super_annotations

          super_annotations.lazy.map do |annotation|
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
          delegated_obj = nil,
          **opts,
          &context_builder
        )
          super(
            delegated_obj || Api[:idah].dataset.annotations,
            args,
            context_args,
            **opts,
            &context_builder
          )
        end
      end
    end
  end
end
