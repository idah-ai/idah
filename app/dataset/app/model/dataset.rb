# frozen_string_literal: true

module Dataset
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Datasets

    field :id, type: String, primary: true
    field :name, type: String

    field :labels, type: Array

    field :modality, type: String, readonly: true

    field :labeling_configuration, type: Hash
    field :workflow_configuration, type: Hash

    field :status, type: String, readonly: true
    field :progress, type: Float, readonly: true

    field :project_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
    has_many :entries, repository: "Entry::Repository", foreign_key: :dataset_id

    def entry_workflow
      Workflow::EntryWorkflow
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "datasets"
    self.resource = Resource::Dataset::Datasets

    encoder :labeling_configuration, Verse::Sequel::JsonEncoder
    encoder :workflow_configuration, Verse::Sequel::JsonEncoder
    encoder :labels, Verse::Sequel::PgArrayEncoder

    def update_progress!(dataset_id)
      total_entries_frag = <<-SQL
        (SELECT COUNT(*)
         FROM entries
         WHERE entries.dataset_id = ?)
      SQL

      total_entries = table.db.fetch(total_entries_frag, dataset_id).first[:count]

      return if total_entries.zero?

      completed_entries_frag = <<-SQL
        (SELECT COUNT(*)
         FROM entries
         WHERE entries.dataset_id = ?
         AND entries.status = 'completed')
      SQL

      completed_count = table.db.fetch(completed_entries_frag, dataset_id).first[:count]

      in_progress_entries_frag = <<-SQL
        (SELECT COUNT(*)
         FROM entries
         WHERE entries.dataset_id = ?
         AND entries.status = 'in_progress')
      SQL

      in_progress_count = table.db.fetch(in_progress_entries_frag, dataset_id).first[:count]

      # Calculate progress as a float (0.0 to 1.0)
      progress = completed_count.to_f / total_entries

      # Determine new status and update accordingly
      if progress >= 1.0
        completed!(dataset_id, progress)
      elsif in_progress_count > 0 || completed_count > 0
        in_progress!(dataset_id, progress)
      end
    end

    event(name: "completed")
    def completed!(dataset_id, progress)
      no_event do
        update!(dataset_id, { progress: progress, status: "completed" })
      end
    end

    event(name: "in_progress")
    def in_progress!(dataset_id, progress)
      no_event do
        update!(dataset_id, { progress: progress, status: "in_progress" })
      end
    end
  end
end
