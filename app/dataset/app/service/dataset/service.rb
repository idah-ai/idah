# frozen_string_literal: true

module Dataset
  class Service < Verse::Service::Base
    use datasets: Dataset::Repository, projects: Project::Repository
    use_system project_members: ProjectMember::Repository,
               entries: Entry::Repository

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

    private def authorize_creation
      access = auth_context.can?(:create, datasets.class.resource)

      if access == :as_org_owner
        project = projects.find!(record.project.id) # this can raise Verse::Error::RecordNotFound if not in org scope
        unless auth_context.custom_scopes[:org]&.include?(project.organization_id.to_s)
          raise Verse::Error::Unauthorized,
                "You do not have permission to create dataset on this project"
        end
      end

      # With "as_user" ensure account can "create" dataset to the project
      if access == :as_user &&
         ScopedQuery::Service.without_project_access?(
           auth_context.metadata[:id],
           record.project.id,
           ["project_owner"]
         )
        raise Verse::Error::Unauthorized,
              "You do not have permission to create dataset on this project"
      end
    end

    def create(record)
      # Validate required relationships
      unless record.project
        raise Verse::Error::ValidationFailed,
              "project relationship is required to create a dataset"
      end

      authorize_creation # permission check

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

    # TODO: TBC; in this case, dataset is duplicating by selecting entry ids
    def duplicate(dataset_id, entry_ids)
      authorize_creation # permission check

      duping_dataset = datasets.find!(dataset_id)

      # TODO: project relationship ? is cross project duplication allowed ?
      datasets.transaction do
        now = Time.now

        dataset_id = datasets.create(
          {
            **duping_dataset.fields,
            id: UUIDv7.generate,
            name: "#{duping_dataset.name} - duplicated",
            # project_id: project_id // this might be needed for cross-project duping
            # use default and to be updated by background jobs ?
            status: "pending",
            # updated_at: Time.now
            entries_total_count: 0,
            entries_completed_count: 0,
            entries_in_progress_count: 0,
            created_at: now,
          }
        )

        # NOTE: as we are duplicating by selecting entry ids, we do a find loop here
        entry_ids.each do |entry_id|
          entry = entries.find(entry_id)

          # check if entry is actually in the duping dataset ?
          next if entry.dataset_id != duping_dataset.id

          # check if media is already successfully processed
          is_media_ready = %w[ready in_progress completed].include?(entry.status)

          attributes = {
            **entry.fields,
            id: UUIDv7.generate,
            dataset_id: dataset_id,
            job_id: nil,
            wf_step: "start",
            status: is_media_ready ? "ready" : "pending",
            assigned_to_id: nil,
            submitted_by_id: nil,
            reviewed_by_id: nil,
            created_at: now,
            updated_at: now
          }

          if is_media_ready
            # INFO: media is already good -> skip processing job
            entries.no_event do
              entries.create(attributes)
            end
          else
            # media needs processing (was in processing or errored) -> trigger new job
            # the event listener will pick up the 'pending' status and start a new job
            entries.create(attributes)
          end
        end

        datasets.find(dataset_id)
      end
    end
  end
end
