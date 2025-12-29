module Context
  module Idah
    IdahContext = Data.define(:contexts) do
      def name
        "idah"
      end

      def method_missing(name, *args, &block)
        Array(contexts).find { |c| c.name == name } || super
      end

      def respond_to_missing?(name, include_private = false)
        !!(Array(contexts).find { |c| c.name == name }) || super
      end
    end
    API = Data.define(:name, :api)

    # TODO: IMPORTANT ! Dont forget to integrate order by on crud or risk possible duplicaton
    # Idah Services HTTP Api builders for args

    from_organizations_api = API.new(:organizations, proc do |args|
      organizations = Idah::Organizations.new(args)
      projects = Idah::Projects.from_organizations(organizations, args)
      project_members = Idah::ProjectMembers.from_projects(projects, args)
      datasets = Idah::Datasets.from_projects(projects, args)
      entries = Idah::Entries.from_datasets(datasets, args)
      annotations = Idah::Entries.from_entries(entries, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Organizations/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_projects_api = API.new(:projects, proc do |args|
      projects = Idah::Projects.new(args)
      organizations = Idah::Organizations.from_projects(projects, args)
      project_members = Idah::ProjectMembers.from_projects(projects, args)
      datasets = Idah::Datasets.from_projects(projects, args)
      entries = Idah::Entries.from_datasets(datasets, args)
      annotations = Idah::Entries.from_entries(entries, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Projects/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_project_members_api = API.new(:project_members, proc do |args|
      project_members = Idah::ProjectMembers.new(args)
      projects = Idah::Projects.from_project_members(project_members, args)
      organizations = Idah::Organizations.from_projects(projects, args)
      datasets = Idah::Datasets.from_projects(projects, args)
      entries = Idah::Entries.from_datasets(datasets, args)
      annotations = Idah::Entries.from_entries(entries, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on ProjectMembers/Crud
      [organizations, projects, project_members, datasets, entries, annotations]
    end)

    from_datasets_api = API.new(:datasets, proc do |args|
      datasets = Idah::Datasets.new(args)
      # projects = Idah::Projects.from_datasets(datasets, args)
      # organizations = Idah::Organizations.from_projects(projects, args)
      # project_members = Idah::ProjectMembers.from_projects(projects, args)
      entries = Idah::Entries.from_datasets(datasets, args)
      annotations = Idah::Annotations.from_entries(entries, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Datasets/Crud
      [
        # organizations, projects, project_members,
        datasets, entries, annotations
      ]
    end)

    from_entries_api = API.new(:entries, proc do |args|
      entries = Idah::Entries.new(args)
      datasets = Idah::Datasets.from_entries(entries, args)
      # projects = Idah::Projects.from_datasets(datasets, args)
      # organizations = Idah::Organizations.from_projects(projects, args)
      # project_members = Idah::ProjectMembers.from_projects(projects, args)
      annotations = Idah::Annotations.from_entries(entries, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Datasets/Crud
      [
        # organizations, projects, project_members,
        datasets, entries, annotations
      ]
    end)

    from_annotations_api = API.new(:annotations, proc do |args|
      annotations = Idah::Annotations.new(args)
      entries = Idah::Entries.from_annotations(annotations, args)
      datasets = Idah::Datasets.from_entries(entries, args)
      # projects = Idah::Projects.from_datasets(datasets, args)
      # organizations = Idah::Organizations.from_projects(projects, args)
      # project_members = Idah::ProjectMembers.from_projects(projects, args)
      # create APIs back up from annotations to make filtering exclusive
      # or integrates query join/include accordingly on Annotations/Crud
      [
        # organizations, projects, project_members,
        datasets, entries, annotations
      ]
    end)

    APIS_FROM = [ # should be ordered according to filtering priority
      # from_organizations_api,
      # from_projects_api,
      # from_project_members_api,
      from_datasets_api,
      from_entries_api,
      from_annotations_api
    ]

    def self.new(args = {})
      args = Hash(args)
      filters = args.keys
      IdahContext.new(
        APIS_FROM.filter{ |api_from|
          filters.include?(api_from.name)
        }.first&.api&.call(args) || [
          # Idah::Organizations.new(args),
          # Idah::Projects.new(args),
          # Idah::ProjectMembers.new(args),
          Idah::Datasets.new(args),
          Idah::Entries.new(args),
          Idah::Annotations.new(args)
        ]
      )
    end
  end
end