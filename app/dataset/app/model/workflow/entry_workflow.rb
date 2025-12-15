# frozen_string_literal: true

require_relative "base"

module Workflow
  class EntryWorkflow < Workflow::Base
    aasm do
      state :start, initial: true
      state :annotate
      state :review
      state :done
      state :error

      # Transition from start to annotation phase
      event :submit, after: :on_submit do
        transitions from: :start, to: :annotate

        transitions from: :annotate, to: :review, if: :should_sample?
        transitions from: :annotate, to: :done, unless: :should_sample?

        transitions from: :review, to: :done, if: :approved?
        transitions from: :review, to: :annotate, unless: :approved?
      end

      event :error do
        transitions from: [:annotate, :review], to: :error
      end
    end

    def sample_rate
      # Get sample rate from dataset workflow configuration
      @entry.dataset.workflow_configuration[:sample_rate] || 1
    end

    def should_sample?
      rand < sample_rate
    end

    def approved?
      unless @submit_opts.key?(:approved)
        raise Verse::Error::ValidationFailed, "Missing required option :approved for review step"
      end

      @submit_opts[:approved]
    end

    def allowed_note_feed?
      # check if current step allows note feeds by state
      ["annotate", "review"].include?(@entry.wf_step)
    end

    private

    def on_submit
      account_id = entries.auth_context.metadata[:id]
      current_state = aasm.current_state
      from_state = aasm.from_state
      to_state = aasm.to_state

      assigned_to_id =
        case from_state
        when :start
          account_id
        when :annotate
          # If moving to review step, assign to reviewer (nil for unassigned)
          @entry.reviewed_by_id
        when :review
          # If moving back to annotation step, re-assign to original annotator
          to_state == :annotate ? @entry.submitted_by_id : nil
        end

      # Set submitted_by_id coming from annotation step
      submitted_by_id = from_state == :annotate ? account_id : @entry.submitted_by_id

      # Set reviewed_by_id coming from review step
      reviewed_by_id = from_state == :review ? account_id : @entry.reviewed_by_id

      entries.submit(
        entry.id,
        {
          wf_step: current_state.to_s,
          status: current_state == :done ? "completed" : "in_progress",
          assigned_to_id:,
          submitted_by_id:,
          reviewed_by_id:,
        }
      )
    end
  end
end
