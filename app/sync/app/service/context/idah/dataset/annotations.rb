module Context
  module Idah
    module Dataset
      class Annotations < Idah::Base
        def builder(annotation)
          id = annotation.dig(:id)
          unless id
            raise Context::Error::InvalidData, "Annotation missing id"
          end

          Unit.new(super(annotation))
        end

        def initialize(
          args = nil,
          context_filters = nil,
          opts = nil,
          api_context = nil,
          &context_builder
        )
          super(
            api_context || Api[:idah].dataset.annotations,
            args,
            context_filters,
            opts,
            &context_builder
          )
        end

        def self.from_entries(entries, args = nil, filters = nil, opts = nil)
          args = entries.build_context_filters_from(args),
          filters = entries.build_context_filters_from(filters),
          opts = entries.build_opts(opts),

          new(
            args, filters, opts,
            ProceduralCrud.new(:annotations, proc do |filter = nil|
              entries.index.flat_map { |e| e.annotations.index(filter) }
            end, args, filters, opts)
          )
        end

        def self.from_projects(projects, args = nil, filters = nil, opts = nil)
          raise NotImplementedError
        end

        def self.root_api(args = nil, context = nil, opts = nil)
          annotations = new(args, context, opts)
          entries = Entries.from_annotations(annotations, annotations.args, annotations.context_filters, opts.merge({delegated:true}))
          datasets = Datasets.from_entries(entries)
          super([datasets], args, context, opts)
        end
      end
    end
  end
end
