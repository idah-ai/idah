module Context
  module Idah
    module Iam
      class Organizations < Base
        def builder(organization)
          id = organization.dig(:id)
          unless id
            raise Context::Error::InvalidData, "Organization missing id"
          end

          filters = build_context_filters_from({
            organizations: {id:}, projects: {organization_id: id}
          })

          Unit.new(
            super(organization), [
              Idah::Dataset::Projects.new(args, filters, opts)
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
            context_api || Api[:idah].iam.organizations,
            args,
            context_filters,
            opts,
            &context_builder
          )
        end

        def self.from_projects(projects, args = nil, filters = nil, opts = nil)
          new(
            projects.build_context_filters_from(args),
            projects.build_context_filters_from(filters),
            opts,
            ProceduralCrud.new(:organizations,
              proc do |filter = nil|
                projects.flat_map { |p| p.organizations.index(filter) }
              end, args, filters, opts
            )
          )
        end

        def self.from_project_members(project_members, args = nil, filters = nil, opts = nil)
          # project_ids = project_members.map { |m| m.dig(:attributes, :project_id) }.compact.to_set

          # # Create an Enumerator that yields Enumerators for each batch
          # batches_enum = project_ids.each_slice(batch_size).map do |batch|
          #   Idah::Dataset::Projects.new(args, { projects: { id__in: batch } }, opts).index
          # end

          # # Merge all Enumerators into one lazy stream
          # Enumerator.new do |yielder|
          #   batches_enum.each do |batch_enum|
          #     batch_enum.each { |project| yielder << project }
          #   end
          # end

          new(
            project_members.build_context_filters_from(args),
            project_members.build_context_filters_from(filters),
            opts,
            from_projects(
              ProceduralCrud.new(:projects,
                proc do |filter = {}|
                  projects_members.map do |project_member|
                      project_member[:attributes][:project_id]
                  end.compact.each_with_object(Set.new) do |id, seen|
                    id unless seen.add?(id)
                  end.compact.each_slice(batch_size).flat_map do |id__in|
                    Idah::Dataset::Projects.new(
                      args, { projects: { id__in: } }, opts
                    ).index(filter)
                  end
                end
              )
            )
          )
        end


        def self.root_api(args = nil, context = nil, opts = nil)
          organizations = Idah::Dataset::Organizations.new(args, context, opts)
          projects = Idah::Dataset::Projects.from_organizations(
            organizations,
            organizations.build_context_filters_from(args),
            organizations.build_context_filters_from(context),
            opts
          )
          project_members = Idah::Dataset::ProjectMembers.from_projects(
            projects,
            projects.build_context_filters_from(args),
            projects.build_context_filters_from(context),
            opts
          )
          datasets = Idah::Dataset::Datasets.from_projects(
            projects,
            projects.build_context_filters_from(args),
            projects.build_context_filters_from(context),
            opts
          )
          entries = Idah::Dataset::Entries.from_datasets(
            datasets,
            datasets.build_context_filters_from(args),
            datasets.build_context_filters_from(context),
            opts
          )
          annotations = Idah::Dataset::Annotations.from_entries(
            entries,
            entries.build_context_filters_from(args),
            entries.build_context_filters_from(context),
            opts
          )

          super([
            # organizations, projects, project_members, datasets, entries, annotations
            datasets
          ], args, context, opts)
        end
      end
    end
  end
end
