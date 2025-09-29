# frozen_string_literal: true

module AnnotationWorkflow
  class Service < Verse::Service::Base
    use entries: Entry::Repository
    use annotations: Annotation::Repository
    use_system datasets: Dataset::Repository

    # Start annotation workflow for an entry
    def start_annotation(entry_id)
      entries.transaction do
        entry = entries.find!(entry_id)
        entry.aasm.current_state = entry.wf_step.to_sym
        # Use AASM to transition to annotation phase
        unless entry.may_begin_annotation?
          raise Verse::Error::ValidationFailed,
                "Cannot start annotation for entry in current state: #{entry.aasm.current_state}"
        end

        # Trigger AASM event which will automatically persist state changes
        entry.begin_annotation!

        # Return updated entry with workflow context
        entries.update!(
          entry_id,
          {
            wf_step: entry.aasm.current_state.to_s, status: "in_progress"
          }
        )

        updated_entry = entries.find!(entry_id, included: [:dataset, :annotations])
        updated_entry.aasm.current_state = updated_entry.wf_step.to_sym

        {
          entry: updated_entry,
          workflow_step: updated_entry.wf_step,
          status: updated_entry.status,
          available_actions: updated_entry.available_actions,
          progress: updated_entry.workflow_progress,
          message: "Annotation workflow started successfully"
        }
      end
    end

    # Submit annotation (when annotator submits from editor)
    def submit_annotation(entry_id, annotation_data, annotator_id)
      entries.transaction do
        entry = entries.find!(entry_id)

        entry.aasm.current_state = entry.wf_step.to_sym

        # Use AASM to submit annotation
        unless entry.may_submit_annotation?
          raise Verse::Error::ValidationFailed,
                "Cannot submit annotation for entry in current state: #{entry.aasm.current_state}"
        end

        # Process and save annotations
        saved_annotations = process_annotation_data(entry_id, annotation_data, annotator_id)

        # Trigger AASM event which will automatically persist state changes
        entry.submit_annotation!
        # Return updated entry with workflow context
        entries.update!(
          entry_id,
          {
            wf_step: entry.aasm.current_state.to_s, status: "completed"
          }
        )
        # Return submission result
        updated_entry = entries.find!(entry_id, included: [:dataset, :annotations])
        updated_entry.aasm.current_state = updated_entry.wf_step.to_sym

        {
          entry: updated_entry,
          annotations: saved_annotations,
          workflow_step: updated_entry.wf_step,
          status: updated_entry.status,
          available_actions: updated_entry.available_actions,
          progress: updated_entry.workflow_progress,
          message: "Annotation submitted successfully"
        }
      end
    end

    # Get workflow status for an entry
    def get_workflow_status(entry_id)
      entry = entries.find!(entry_id, included: [:dataset, :annotations])

      {
        entry_id: entry.id,
        workflow_step: entry.wf_step,
        status: entry.status,
        annotations_count: entry.annotations.length,
        progress: entry.workflow_progress,
        available_actions: entry.available_actions
      }
    end

    # Reset workflow for error recovery
    def reset_workflow(entry_id)
      entries.transaction do
        entry = entries.find!(entry_id)
        entry.aasm.current_state = entry.wf_step.to_sym
        # Use AASM to reset workflow
        unless entry.may_reset_workflow?
          raise Verse::Error::ValidationFailed,
                "Cannot reset workflow for entry in current state: #{entry.aasm.current_state}"
        end

        # Trigger AASM event which will automatically persist state changes
        entry.reset_workflow!

        entries.update!(
          entry_id,
          {
            wf_step: entry.aasm.current_state.to_s, status: "ready"
          }
        )
        # Return updated entry with workflow context
        updated_entry = entries.find!(entry_id, included: [:dataset, :annotations])
        updated_entry.aasm.current_state = updated_entry.wf_step.to_sym

        {
          entry: updated_entry,
          workflow_step: updated_entry.wf_step,
          status: updated_entry.status,
          available_actions: updated_entry.available_actions,
          progress: updated_entry.workflow_progress,
          message: "Workflow reset successfully"
        }
      end
    end

    private

    def process_annotation_data(entry_id, annotation_data, annotator_id)
      saved_annotations = []

      # Delete existing annotations for this entry (if updating)
      existing_annotations = annotations.index({ entry_id: entry_id })
      existing_annotations.each do |annotation|
        annotations.delete(annotation.id)
      end

      # Create new annotations
      annotation_data.each do |annotation_item|
        # annotation_record = annotations.create(

        # )

        annotation_id = annotations.create(
          {
            id: UUIDv7.generate,
            entry_id: entry_id,
            dimensions: annotation_item[:dimensions] || {},
            annotation: annotation_item[:annotation] || {},
            created_by_id: annotator_id
          }
        )
        saved_annotations << annotations.find!(annotation_id)
      end

      saved_annotations
    end
  end
end
