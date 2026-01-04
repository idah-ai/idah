module Context
  module ApiIdah
    module Dataset
      class Annotations < ApiIdah::Base
        def builder(annotation)
          # Validate required nested attributes
          entry_id = annotation.dig(:attributes, :entry_id)
          unless entry_id
            raise Context::Error::InvalidData, "Annotation missing entry_id in attributes"
          end

          Unit.new(super(annotation),[
            Entries.new(args, build_context_filters({ id: entry_id }, :entries), opts)
          ])
        end

        def initialize(
          args = nil,
          context_filters = nil,
          opts = nil,
          api_context = nil,
          &context_builder
        )
          # Dependency injection: allow passing api_context for testing
          api_context ||= Api[:idah].dataset.annotations

          super(
            api_context,
            args,
            context_filters,
            opts,
            &context_builder
          )
        end

        def self.from_entries(entries, args = {}, filters = {}, opts = {})
          new(
            entries.build_context_filters_from(args),
            entries.build_context_filters_from(filters),
            opts,
            ProceduralCrud.new(:annotations, proc do |filter = {}|
              entries.index.flat_map { |e| e.annotations.index(filter) }
            end, args, filters, opts)
          )
        end

        def self.idah_apis(args = {}, context = {}, opts = {})
          annotations = new(args, context, opts)
          entries = Entries.from_annotations(annotations, annotations.args, annotations.context_filters, opts.merge({delegated:true}))
          datasets = Datasets.from_entries(entries)
          projects = Projects.from_datasets(datasets)
          project_members = ProjectMembers.from_projects(projects)
          organizations = ApiIdah::Iam::Organizations.from_projects(projects)

          super([
            organizations, projects, project_members, datasets, entries, annotations
          ], args, context, opts)
        end
      end
    end
  end
end
