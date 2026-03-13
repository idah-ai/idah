# frozen_string_literal: true

module Dataset
  class Service < Verse::Service::Base
    use datasets: Dataset::Repository,
        projects: Project::Repository,
        entries: Entry::Repository,
        annotations: Annotation::Repository
    use_system project_members: ProjectMember::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      datasets.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      datasets.find!(id, included: included)
    end

    def create(record)
      # Validate required relationships
      unless record.project
        raise Verse::Error::ValidationFailed,
              "project relationship is required to create a dataset"
      end

      authorize_creation(record.project.id) # permission check

      # Assign attributes
      attributes = record.attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:project_id] = record.project.id
      # attributes[:created_by_email] ||= auth_context.metadata[:email]

      datasets.transaction do
        id = datasets.create(attributes)
        datasets.find(id)
      end
    end

    def update(record)
      datasets.update!(record.id, record.attributes)
      datasets.find!(record.id)
    end

    def delete(id)
      dataset = datasets.find!(id)
      if %w[in_progress completed].include?(dataset.status)
        raise Verse::Error::Unauthorized, "Unable to delete in progress or completed dataset"
      end

      datasets.delete!(id)
    end

    def notify_dataset_completed(dataset_id)
      dataset = datasets.find!(dataset_id, included: ["project"])

      project_owner_members = project_members.index(
        { project_id: dataset.project_id, role: "project_owner" },
      )

      project_owner_members.each do |member|
        ::Service::Notification.email(
          to: member.email,
          title: "Dataset has been Completed",
          category: "dataset_completed",
          type: "notification:project:activities",
          recipient_id: member.account_id,
          dataset_name: dataset.name,
          project_name: dataset.project.name,
          recipient_name: member.name,
          dataset_id: dataset.id,
          project_id: dataset.project.id
        )
      end
    end

    # TODO: add spec tests
    # TODO: TBC; in this case, dataset is duplicating by selecting entry ids
    def duplicate(dataset_id, entry_ids: nil, with_annotations: false)
      duping_dataset = datasets.find!(dataset_id)

      authorize_creation(duping_dataset.project_id) # permission check

      # TODO: project relationship ? is cross project duplication allowed ? override and pass project_id if so
      datasets.transaction do
        now = Time.now

        dataset_id = datasets.create(
          {
            **duping_dataset.fields,
            id: UUIDv7.generate,
            # project_id: project_id, // this might be needed for cross-project duping
            name: "#{duping_dataset.name} - duplicated",
            status: "pending",
            entries_total_count: 0,
            entries_completed_count: 0,
            entries_in_progress_count: 0,
            created_at: now,
          }
        )

        dataset = datasets.find(dataset_id)

        # just return if there's no entry in this duping dataset
        return dataset if duping_dataset.entries_total_count == 0

        # fire to dupe every entries if !entry_ids, or dupe only selected entries, before returning
        datasets.duplicated(dataset_id, project_id: dataset.project_id, entry_ids:, with_annotations:)
        return dataset
      end
    end

    private def authorize_creation(project_id)
      access = auth_context.can?(:create, datasets.class.resource)

      if access == :as_org_owner
        project = projects.find!(project_id) # this can raise Verse::Error::RecordNotFound if not in org scope
        unless auth_context.custom_scopes[:org]&.include?(project.organization_id.to_s)
          raise Verse::Error::Unauthorized,
                "You do not have permission to create dataset on this project"
        end
      end

      # With "as_user" ensure account can "create" dataset to the project
      if access == :as_user &&
         ScopedQuery::Service.without_project_access?(
           auth_context.metadata[:id],
           project_id,
           ["project_owner"]
         )
        raise Verse::Error::Unauthorized,
              "You do not have permission to create dataset on this project"
      end
    end
  end
end
