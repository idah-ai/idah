module Context
  class Idah < Root
    API = Data.define(:name, :api)

    def initialize(args = {})
      args = Hash(args)
      filters = args.keys
      super(APIS_FOR_FILTERS.filter { |api_for|
            filters.include?(api_for.name)
          }.first&.api&.call(args) || [
            # IdahContext::Organizations.new(args),
            # IdahContext::Projects.new(args),
            # IdahContext::ProjectMembers.new(args),
            IdahContext::Datasets.new(args),
            IdahContext::Entries.new(args),
            IdahContext::Annotations.new(args)
          ])
    end

    from_organizations_api = API.new(:organizations, proc do |args|
      organizations = IdahContext::Organizations.new(args)
      projects = IdahContext::Projects.from_organizations(organizations, args)
      project_members = IdahContext::ProjectMembers.from_projects(projects, args)
      datasets = IdahContext::Datasets.from_projects(projects, args)
      entries = IdahContext::Entries.from_datasets(datasets, args)
      annotations = IdahContext::Annotations.from_entries(entries, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Organizations/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_projects_api = API.new(:projects, proc do |args|
      projects = IdahContext::Projects.new(args)
      organizations = IdahContext::Organizations.from_projects(projects, args)
      project_members = IdahContext::ProjectMembers.from_projects(projects, args)
      datasets = IdahContext::Datasets.from_projects(projects, args)
      entries = IdahContext::Entries.from_datasets(datasets, args)
      annotations = IdahContext::Entries.from_entries(entries, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Projects/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_project_members_api = API.new(:project_members, proc do |args|
      project_members = IdahContext::ProjectMembers.new(args)
      projects = IdahContext::Projects.from_project_members(project_members, args)
      organizations = IdahContext::Organizations.from_projects(projects, args)
      datasets = IdahContext::Datasets.from_projects(projects, args)
      entries = IdahContext::Entries.from_datasets(datasets, args)
      annotations = IdahContext::Entries.from_entries(entries, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on ProjectMembers/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_datasets_api = API.new(:datasets, proc do |args|
      datasets = IdahContext::Datasets.new(args)
      # projects = IdahContext::Projects.from_datasets(datasets, args)
      # organizations = IdahContext::Organizations.from_projects(projects, args)
      # project_members = IdahContext::ProjectMembers.from_projects(projects, args)
      entries = IdahContext::Entries.from_datasets(datasets, args)
      annotations = IdahContext::Annotations.from_entries(entries, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Datasets/Crud
      [
        # organizations, projects, project_members,
        datasets, entries, annotations
      ]
    end)

    from_entries_api = API.new(:entries, proc do |args|
      entries = IdahContext::Entries.new(args)
      datasets = IdahContext::Datasets.from_entries(entries, args)
      # projects = IdahContext::Projects.from_datasets(datasets, args)
      # organizations = IdahContext::Organizations.from_projects(projects, args)
      # project_members = IdahContext::ProjectMembers.from_projects(projects, args)
      annotations = IdahContext::Annotations.from_entries(entries, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Datasets/Crud
      [
        # organizations, projects, project_members,
        datasets, entries, annotations
      ]
    end)

    from_annotations_api = API.new(:annotations, proc do |args|
      annotations = IdahContext::Annotations.new(args)
      entries = IdahContext::Entries.from_annotations(annotations, args)
      datasets = IdahContext::Datasets.from_entries(entries, args)
      # projects = IdahContext::Projects.from_datasets(datasets, args)
      # organizations = IdahContext::Organizations.from_projects(projects, args)
      # project_members = IdahContext::ProjectMembers.from_projects(projects, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Annotations/Crud
      [
        # organizations, projects, project_members,
        datasets, entries, annotations
      ]
    end)

    APIS_FOR_FILTERS = [
      # from_organizations_api,
      # from_projects_api,
      # from_project_members_api,
      from_datasets_api,
      from_entries_api,
      from_annotations_api
    ]
  end
end