module Context
  module Idah
    module Dataset
      class Projects < Base
        def builder(project)
          project_id = project[:id]
          unless project_id
            raise Context::Error::InvalidData, "Project missing id"
          end

          org_id = project.dig(:attributes, :organization_id)
          unless org_id
            raise Context::Error::InvalidData, "Project missing organization_id in attributes"
          end

          Unit.new(
            super(project),
            [
              ProjectMembers.new(args, build_context_filters({ project_id: project_id }, :project_members), opts),
              Datasets.new(args, build_context_filters({ project_id: project_id }, :datasets), opts),
              Idah::Iam::Organizations.new(args, build_context_filters({ id: org_id }, :organizations), opts)
            ]
          )
        end

        def initialize(
          args = nil,
          context_filters = nil,
          opts = nil,
          context_api = nil,
          &context_builder
        )
          super(
            context_api || Api[:idah].dataset.projects,
            args,
            context_filters,
            opts,
            &context_builder
          )
        end

        def self.from_organizations(organizations, args = nil, filters = nil, opts = nil)
          batch_size = opts[:batch_size] || DEFAULT_BATCH_SIZE

          new(
            organizations.build_context_filters_from(args),
            organizations.build_context_filters_from(filters),
            opts,
            ProceduralCrud.new(:projects, proc do |filter = nil|
              organization_ids = organizations.index.map { |o| o.record[:id] }.compact.uniq
              organization_ids.each_slice(batch_size).flat_map do |organization_id__in|
                Projects.new(args, { projects: { organization_id__in: } }, opts).index(filter)
              end
            end, args, filters, opts)
          )
        end

        def self.from_project_members(project_members, args = nil, filters = nil, opts = nil)
          batch_size = opts[:batch_size] || DEFAULT_BATCH_SIZE

          new(
            project_members.build_context_filters_from(args),
            project_members.build_context_filters_from(filters),
            opts,
            ProceduralCrud.new(:projects, proc do |filter = nil|
                project_ids = project_members.index.map { |pm| pm.record.dig(:attributes, :project_id) }.compact.uniq
                project_ids.each_slice(batch_size).flat_map do |id__in|
                  Projects.new(args, { projects: { id__in: } }, opts).index(filter)
                end
              end, args, filters, opts)
            )
        end

        def self.from_datasets(datasets, args = nil, filters = nil, opts = nil)
          batch_size = opts[:batch_size] || DEFAULT_BATCH_SIZE

          new(
            datasets.build_context_filters_from(args),
            datasets.build_context_filters_from(filters),
            opts,
            ProceduralCrud.new(:projects, proc do |filter = nil|
              project_ids = datasets.index.map { |d| d.record.dig(:attributes, :project_id) }.compact.uniq
              project_ids.each_slice(batch_size).flat_map do |id__in|
                Projects.new(args, { projects: { id__in: } }, opts).index(filter)
              end
            end, args, filters, opts)
          )
        end


        def self.root_api(args = nil, context = nil, opts = nil)
          projects = Projects.new(args, context, opts)
          organizations = Organizations.from_projects(projects, args, context, opts)
          project_members = ProjectMembers.from_projects(projects, args, context, opts)
          datasets = Datasets.from_projects(projects, args, context, opts)
          entries = Entries.from_datasets(datasets, args, context, opts)
          annotations = Annotations.from_entries(entries, args, context, opts)

          super([
            # organizations, projects, project_members, datasets, entries, annotations
            datasets
          ], args, context, opts)
        end
      end
    end
  end
end