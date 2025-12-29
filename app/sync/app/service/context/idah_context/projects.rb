module Context
  module IdahContext
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
              ProjectMembers.new(args, merge_context_filters(project_id: project[:id])),
              Datasets.new(args, merge_context_filters(project_id: project[:id])),
              Entries.new(args, merge_context_filters(project_id: project[:id])),
              Annotations.new(args, merge_context_filters(project_id: project[:id])),
              Organizations.new(args, merge_context_filters(id: project[:attributes][:organization_id]))
            )
          end
        )
      end

      def self.from_organizations(organizations, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:entries, proc do |filter = {}|
            organization_ids = organizations.index.map { |o| o.record[:id] }.compact.uniq
            organization_ids.each_slice(100).flat_map do |organization_id__in|
              Projects.new(args, {projects:{organization_id__in:}}).index(filter)
            end
          end)
        )
      end

      def self.from_project_members(project_members, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:entries, proc do |filter = {}|
            project_ids = organizations.index.map { |o| o.record[:attributes][:project_id] }.compact.uniq
            project_ids.each_slice(100).flat_map do |id__in|
              Projects.new(args, {projects:{id__in:}}).index(filter)
            end
          end)
        )
      end

    end
  end
end
