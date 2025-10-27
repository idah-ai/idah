# frozen_string_literal: true

module Entry
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Entries

    field :id, type: String, primary: true

    field :dataset_id, type: String, readonly: true

    field :priority, type: Integer

    field :wf_step, type: String # , readonly: true
    field :status, type: String # , readonly: true

    field :job_id, type: Integer

    field :resource, type: String

    # Add through assign method
    field :assigned_to_id, type: Integer, readonly: true

    field :created_by_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
    has_many :annotations, repository: "Annotation::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "entries"
    self.resource = Resource::Dataset::Entries

    # scope definition(s)
    def scoped(action)
      auth_context.can!(action, Resource::Dataset::Entries) do |scope|
        scope.all? { table }

        scope.as_user? do
          account_id = auth_context.metadata[:id]

          # projects/datasets that is a member of
          project_ids = ProjectMember::Repository.new(auth_context).index({ account_id: }).map(&:project_id).uniq
          dataset_ids = Dataset::Repository.new(auth_context).index({ project_id: project_ids }).map(&:id).uniq

          # entries that are in projects/datasets that is a member of or owned entries
          table.where(dataset_id: dataset_ids).or(created_by_id: account_id)
        end
      end
    end

    def create(attributes)
      attributes[:created_by_id] = auth_context.metadata[:id] unless attributes[:created_by_id]

      super(attributes)
    end

    def mark_entries_as_ready(job_id)
      entries = chunked_index({ job_id: job_id, status: "pending" })

      transaction do
        entries.each do |entry|
          update!(entry.id, { status: "ready" })
        end
      end
    end
  end
end
