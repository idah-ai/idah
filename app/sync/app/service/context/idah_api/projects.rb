module Context
  module IdahApi
    class Projects < Crud
      Context = Data.define(:record, :api, :members, :datasets, :entries, :annotations, :organizations)

      def builder(project)
        Context.new(project,
          Projects.new(args, build_context_filters(id: project[:id]), opts),
          ProjectMembers.new(args, build_context_filters({project_id: project[:id]}, :project_members), opts),
          Datasets.new(args, build_context_filters({project_id: project[:id]}, :datasets), opts),
          Entries.new(args, build_context_filters({project_id: project[:id]}, :entries), opts),
          Annotations.new(args, build_context_filters({project_id: project[:id]}, :annotations), opts),
          Organizations.new(args, build_context_filters({id: project[:attributes][:organization_id]}, :organizations), opts)
        )
      end

      def initialize(args = {}, context_filters = {}, opts = {}, context_api = Api[:idah].dataset.projects, &context_builder)
        super(
          context_api,
          args,
          context_filters,
          opts,
          &context_builder
        )
      end

      def self.from_organizations(organizations, args = {}, filters = {}, opts = {})
        new(
          organizations.build_context_filters_from(args), organizations.build_context_filters_from(filters), opts,
          Delegate.new(:projects, proc do |filter = {}|
            organization_ids = organizations.index.map { |o| o.record[:id] }.compact.uniq
            organization_ids.each_slice(100).flat_map do |organization_id__in|
              Projects.new(args, {projects:{organization_id__in:}}, opts).index(filter)
            end
          end, args, filters, opts)
        )
      end

      def self.from_project_members(project_members, args = {}, filters = {}, opts = {})
        new(
          project_members.build_context_filters_from(args), project_members.build_context_filters_from(filters), opts,
          Delegate.new(:projects, proc do |filter = {}|
            project_ids = project_members.index.map { |o| o.record[:attributes][:project_id] }.compact.uniq
            project_ids.each_slice(100).flat_map do |id__in|
              Projects.new(args, {projects:{id__in:}}, opts).index(filter)
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
        annotations = Entries.from_entries(entries, args, context, opts)
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on Projects/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
