# frozen_string_literal: true

require "aasm"

module Entry
  class Record < Verse::Model::Record::Base
    include AASM

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

    # after_initialize :sync_aasm_state

    # Simple AASM Workflow State Machine: start -> annotate -> done
    aasm column: :wf_step do
      state :start, initial: true
      state :annotate
      state :done

      # after_all_transitions :persist_workflow_state

      # Transition from start to annotation phase
      event :begin_annotation do
        transitions from: :start, to: :annotate
      end

      # Submit annotation and complete workflow
      event :submit_annotation do
        transitions from: :annotate, to: :done
      end

      # Reset workflow (for error recovery)
      event :reset_workflow do
        transitions from: [:annotate, :done], to: :start
      end
    end

    # Helper methods
    def workflow_progress
      case aasm.current_state
      when :start
        0.0
      when :annotate
        0.5
      when :done
        1.0
      else
        0.0
      end
    end

    def available_actions
      actions = []

      case aasm.current_state
      when :start
        actions << :begin_annotation if may_begin_annotation?
      when :annotate
        actions << :submit_annotation if may_submit_annotation?
      when :done
        # No actions available when done
      end

      # Always allow reset
      actions << :reset_workflow if may_reset_workflow?

      actions
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "entries"
    self.resource = Resource::Dataset::Entries

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
