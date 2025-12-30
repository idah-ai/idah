module Context
  module IdahApi
    class Projects < Crud
      Context = Data.define(:record, :api, :members, :datasets, :entries, :annotations, :organizations)

      def initialize(args = {}, context_filters = {}, opts = {}, context_api, &context_builder)
        super(
          context_api,
          args,
          context_filters,
          opts,
          context_builder ||= proc do |project|
            Context.new(project,
              Projects.new(args, merge_context_filters(id: project[:id])),
              ProjectMembers.new(args, merge_context_filters({project_id: project[:id]}, :project_members)),
              Datasets.new(args, merge_context_filters({project_id: project[:id]}, :datasets)),
              Entries.new(args, merge_context_filters({project_id: project[:id]}, :entries)),
              Annotations.new(args, merge_context_filters({project_id: project[:id]}, :annotations)),
              Organizations.new(args, merge_context_filters({id: project[:attributes][:organization_id]}, :organizations))
            )
          end
        )
      end

      def self.from_organizations(organizations, args = {}, filters = {}, opts = {})
        new(
          organizations.merge_context_filters(args), organizations.merge_context_filters(filters), opts,
          Delegate.new(:entries, proc do |filter = {}|
            organization_ids = organizations.index.map { |o| o.record[:id] }.compact.uniq
            organization_ids.each_slice(100).flat_map do |organization_id__in|
              Projects.new(args, {projects:{organization_id__in:}}, opts).index(filter)
            end
          end)
        )
      end

      def self.from_project_members(project_members, args = {}, filters = {}, opts = {})
        new(
          project_members.merge_context_filters(args), project_members.merge_context_filters(filters), opts,
          Delegate.new(:entries, proc do |filter = {}|
            project_ids = organizations.index.map { |o| o.record[:attributes][:project_id] }.compact.uniq
            project_ids.each_slice(100).flat_map do |id__in|
              Projects.new(args, {projects:{id__in:}}, opts).index(filter)
            end
          end)
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
