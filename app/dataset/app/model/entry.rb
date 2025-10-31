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

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
    has_many :annotations, repository: "Annotation::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "entries"
    self.resource = Resource::Dataset::Entries

    def mark_entries_as_ready(job_id)
      entries = chunked_index({ job_id: job_id, status: "processing" })

      transaction do
        entries.each do |entry|
          update!(entry.id, { status: "ready" })
        end
      end
    end

    def mark_entries_as_errored(job_id)
      entries = chunked_index({ job_id: job_id, status: "processing" })

      transaction do
        entries.each do |entry|
          update!(entry.id, { status: "errored" })
        end
      end
    end
  end
end
