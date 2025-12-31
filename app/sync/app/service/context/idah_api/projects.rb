module Context
  module IdahApi
    class Projects < Crud
      Context = Data.define(:record, :api, :members, :datasets, :entries, :annotations, :organizations)

      def builder(project)
        project_id = project[:id]
        unless project_id
          raise Sync::Error::InvalidData, "Project missing id"
        end

        org_id = project.dig(:attributes, :organization_id)
        unless org_id
          raise Sync::Error::InvalidData, "Project missing organization_id in attributes"
        end

        Context.new(
          project,
          Projects.new(args, build_context_filters(id: project_id), opts),
          ProjectMembers.new(args, build_context_filters({ project_id: project_id }, :project_members), opts),
          Datasets.new(args, build_context_filters({ project_id: project_id }, :datasets), opts),
          Entries.new(args, build_context_filters({ project_id: project_id }, :entries), opts),
          Annotations.new(args, build_context_filters({ project_id: project_id }, :annotations), opts),
          Organizations.new(args, build_context_filters({ id: org_id }, :organizations), opts)
        )
      end

      def initialize(
        args = {},
        context_filters = {},
        opts = {},
        context_api = nil,
        &context_builder
      )
        # Dependency injection: allow passing context_api for testing
        context_api ||= Api[:idah].dataset.projects

        super(
          context_api,
          args,
          context_filters,
          opts,
          &context_builder
        )
      end

      def self.from_organizations(organizations, args = {}, filters = {}, opts = {})
        batch_size = opts[:batch_size] || 100

        new(
          organizations.build_context_filters_from(args),
          organizations.build_context_filters_from(filters),
          opts,
          Delegate.new(:projects, proc do |filter = {}|
            organization_ids = organizations.index.map { |o| o.record[:id] }.compact.uniq
            organization_ids.each_slice(batch_size).flat_map do |organization_id__in|
              Projects.new(args, { projects: { organization_id__in: } }, opts).index(filter)
            end
          end, args, filters, opts)
        )
      end

      def self.from_project_members(project_members, args = {}, filters = {}, opts = {})
        batch_size = opts[:batch_size] || 100

        new(
          project_members.build_context_filters_from(args),
          project_members.build_context_filters_from(filters),
          opts,
          Delegate.new(:projects, proc do |filter = {}|
            project_ids = project_members.index.map { |pm| pm.record.dig(:attributes, :project_id) }.compact.uniq
            project_ids.each_slice(batch_size).flat_map do |id__in|
              Projects.new(args, { projects: { id__in: } }, opts).index(filter)
            end
          end, args, filters, opts)
        )
      end

      def self.idah_apis(args = {}, context = {}, opts = {})
        projects = Projects.new(args, context, opts)
        organizations = Organizations.from_projects(projects, args, context, opts)
        project_members = ProjectMembers.from_projects(projects, args, context, opts)
        datasets = Datasets.from_projects(projects, args, context, opts)
        entries = Entries.from_datasets(datasets, args, context, opts)
        annotations = Annotations.from_entries(entries, args, context, opts)

        # Returns APIs ordered from top-level to leaf-level
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end