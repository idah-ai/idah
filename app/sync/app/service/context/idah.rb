module Context
  class Idah < Base
    API = Data.define(:name, :api)

    def initialize(args = {}, context = {})
      Verse::logger.debug {{init: self, args:, context:}}
      args = Hash(args)
      context = Hash(context)
      filters = args.keys
      Verse::logger.debug {{init: self, args:, context:, filters:}}
      super(
        Root.new(
          APIS_FOR_FILTERS.filter { |api_for|
            filters.include?(api_for.name)
          }.first&.api&.call(args, context) || [
            IdahContext::Organizations.new(args, context),
            IdahContext::Projects.new(args, context),
            IdahContext::ProjectMembers.new(args, context),
            IdahContext::Datasets.new(args, context),
            IdahContext::Entries.new(args, context),
            IdahContext::Annotations.new(args, context)
          ]
        )
      )
    end

    def method_missing(name, *args, &block)
      if @context_api.respond_to?(name)
        @context_api.send(name, *args, &block)
      else
        super
      end
    end

    def respond_to_missing?(name, include_private = false)
      @context_api.respond_to?(name) || super
    end


    from_organizations_api = API.new(:organizations, proc do |args, context|
      Verse.logger.debug {{from: :organizations}}
      organizations = IdahContext::Organizations.new(args, context)
      projects = IdahContext::Projects.from_organizations(organizations, args, context)
      project_members = IdahContext::ProjectMembers.from_projects(projects, args, context)
      datasets = IdahContext::Datasets.from_projects(projects, args, context)
      entries = IdahContext::Entries.from_datasets(datasets, args, context)
      annotations = IdahContext::Annotations.from_entries(entries, args, context)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Organizations/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_projects_api = API.new(:projects, proc do |args, context|
      Verse.logger.debug {{from: :projects}}
      projects = IdahContext::Projects.new(args, context)
      organizations = IdahContext::Organizations.from_projects(projects, args, context)
      project_members = IdahContext::ProjectMembers.from_projects(projects, args, context)
      datasets = IdahContext::Datasets.from_projects(projects, args, context)
      entries = IdahContext::Entries.from_datasets(datasets, args, context)
      annotations = IdahContext::Entries.from_entries(entries, args, context)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Projects/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_project_members_api = API.new(:project_members, proc do |args, context|
      Verse.logger.debug {{from: :project_members}}
      project_members = IdahContext::ProjectMembers.new(args, context)
      projects = IdahContext::Projects.from_project_members(project_members, args, context)
      organizations = IdahContext::Organizations.from_projects(projects, args, context)
      datasets = IdahContext::Datasets.from_projects(projects, args, context)
      entries = IdahContext::Entries.from_datasets(datasets, args, context)
      annotations = IdahContext::Entries.from_entries(entries, args, context)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on ProjectMembers/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_datasets_api = API.new(:datasets, proc do |args, context|
      Verse.logger.debug {{from: :datasets}}
      datasets = IdahContext::Datasets.new(args, context)
      projects = IdahContext::Projects.from_datasets(datasets, args, context)
      organizations = IdahContext::Organizations.from_projects(projects, args, context)
      project_members = IdahContext::ProjectMembers.from_projects(projects, args, context)
      entries = IdahContext::Entries.from_datasets(datasets, args, context)
      annotations = IdahContext::Annotations.from_entries(entries, args, context)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Datasets/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_entries_api = API.new(:entries, proc do |args, context|
      Verse.logger.debug {{from: :entries}}
      entries = IdahContext::Entries.new(args, context)
      datasets = IdahContext::Datasets.from_entries(entries, args, context)
      projects = IdahContext::Projects.from_datasets(datasets, args, context)
      organizations = IdahContext::Organizations.from_projects(projects, args, context)
      project_members = IdahContext::ProjectMembers.from_projects(projects, args, context)
      annotations = IdahContext::Annotations.from_entries(entries, args, context)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Entries/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_annotations_api = API.new(:annotations, proc do |args, context|
      Verse.logger.debug {{from: :annotations}}
      annotations = IdahContext::Annotations.new(args, context)
      entries = IdahContext::Entries.from_annotations(annotations, args, context)
      datasets = IdahContext::Datasets.from_entries(entries, args, context)
      projects = IdahContext::Projects.from_datasets(datasets, args, context)
      organizations = IdahContext::Organizations.from_projects(projects, args, context)
      project_members = IdahContext::ProjectMembers.from_projects(projects, args, context)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Annotations/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    APIS_FOR_FILTERS = [
      from_organizations_api,
      from_projects_api,
      from_project_members_api,
      from_datasets_api,
      from_entries_api,
      from_annotations_api
    ]
  end
end
