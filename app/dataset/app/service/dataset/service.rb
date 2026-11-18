# frozen_string_literal: true

module Dataset
  class Service < Verse::Service::Base
    use datasets: Dataset::Repository,
        projects: Project::Repository,
        entries: Entry::Repository,
        annotations: Annotation::Repository
    use_system project_members: ProjectMember::Repository,
               note_feeds: NoteFeed::Repository,
               annotations_system: Annotation::Repository

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
      DeliveryDate.validate!(attributes)
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:project_id] = record.project.id
      # attributes[:created_by_email] ||= auth_context.metadata[:email]

      datasets.transaction do
        id = datasets.create(attributes)
        datasets.find(id)
      end
    end

    def update(record)
      datasets.transaction do
        old_dataset = datasets.find!(record.id)
        DeliveryDate.validate!(record.attributes, old_dataset.delivery_date)
        datasets.update!(record.id, record.attributes)

        if record.attributes.key?(:labeling_configuration)
          old_ids = old_dataset.configured_category_ids

          new_ids = Dataset::Record.new(record.attributes).configured_category_ids

          removed_category_ids = old_ids - new_ids

          added_ids = new_ids - old_ids

          readded_category_ids =
            if added_ids.any?
              added_ids & annotations_system.distinct_annotation_categories(record.id)
            else
              []
            end

          changed = removed_category_ids | readded_category_ids

          if changed.any?
            # Flag the sweep in this request, so the response (and the first
            # poll) already reports it before the async recompute starts.
            datasets.no_event { datasets.update!(record.id, { syncing_stats: true, syncing_stats_at: Time.now }) }
            datasets.labeling_configuration_updated(record.id, changed_category_ids: changed)
          end
        end

        datasets.find!(record.id)
      end
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

    def duplicate(dataset_id, dataset_name: nil, entry_ids: nil, with_labels: false, with_annotations: false)
      duping_dataset = datasets.find!(dataset_id)

      authorize_creation(duping_dataset.project_id) # permission check

      datasets.transaction do
        now = Time.now

        dataset_id = datasets.create(
          {
            **duping_dataset.fields,
            delivery_date: nil,
            id: UUIDv7.generate,
            name: dataset_name || "#{duping_dataset.name} - duplicated",
            status: "pending",
            labeling_configuration: with_labels ? duping_dataset.labeling_configuration : {},
            feedback_configuration: duping_dataset.feedback_configuration,
            entries_total_count: 0,
            entries_completed_count: 0,
            entries_in_progress_count: 0,
            created_at: now,
            updated_at: now,
          }
        )

        dataset = datasets.find(dataset_id)

        # just return if there's no entry in this duping dataset
        return dataset if duping_dataset.entries_total_count == 0

        # fire to dupe every entries if !entry_ids, or dupe only selected entries, before returning
        datasets.duplicate(
          dataset_id,
          duping_dataset_id: duping_dataset.id,
          entry_ids:,
          with_annotations:
        )
        return dataset
      end
    end

    # Feedback Configuration Management
    def update_feedback_configuration(dataset_id, new_config)
      # Validate the structure of the payload before storing it.
      new_config = FeedbackConfigSchema.validate!(new_config)

      datasets.transaction do
        # Lock the dataset row (SELECT ... FOR UPDATE) so concurrent
        # read-modify-write cycles serialize on this row instead of silently
        # overwriting each other's committed items. The removed-key diff below
        # therefore always runs against the latest committed configuration.
        dataset = datasets.lock!(dataset_id)
        old_config = dataset.feedback_configuration || {}

        old_keys = old_config.keys.map(&:to_s)
        new_keys = new_config.keys.map(&:to_s)

        removed_keys = old_keys - new_keys

        removed_keys.each do |key|
          if note_feed_uses_feedback_key?(dataset_id, key)
            raise Verse::Error::ValidationFailed,
                  "Cannot remove feedback item '#{key}': it is already used by a note"
          end
        end

        datasets.update!(dataset_id, { feedback_configuration: new_config })
        datasets.find!(dataset_id).feedback_configuration
      end
    end

    def feedback_keys_in_use(dataset_id)
      # Existence + read-authorization check. The keys query below runs on a
      # system repository, so there is nothing to snapshot here — a transaction
      # would not wrap it anyway.
      datasets.find!(dataset_id)

      { keys: note_feeds.feedback_keys_in_use(dataset_id) }
    end

    private

    def note_feed_uses_feedback_key?(dataset_id, key)
      note_feeds.feedback_key_in_use?(dataset_id, key)
    end

    def authorize_creation(project_id)
      # Decides on the actor's effective access on the concrete project so an
      # org_owner with a membership on a foreign project is evaluated with their
      # membership role, not org_owner powers.
      access = ProjectAccess::Service.resolve(
        auth_context, project_id, action: :create, resource: datasets.class.resource
      )

      # Only effective rank >= project_owner may create a dataset.
      effective_rank = ProjectAccess::Service.effective_rank(
        auth_context, project_id, action: :create, resource: datasets.class.resource
      )
      unless effective_rank && effective_rank >= RoleHierarchy.rank("project_owner")
        raise Verse::Error::Unauthorized,
              "You do not have permission to create dataset on this project"
      end

      access
    end
  end
end
