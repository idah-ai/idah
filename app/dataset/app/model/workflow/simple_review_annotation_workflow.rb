# frozen_string_literal: true

require_relative "base"

module Workflow
  class SimpleReviewAnnotationWorkflow < Workflow::Base
    aasm do
      state :start, initial: true
      state :annotate
      state :review
      state :done
      state :error

      # Transitions
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

    # Fraction of annotated entries routed to review, read from the dataset's
    # workflow_configuration. Expected range 0..1; defaults to 1 when unset,
    # so review is mandatory unless an operator explicitly lowers it. A value
    # of 0 skips review entirely (annotate transitions straight to done).
    def sample_rate
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
      account_email = entries.auth_context.metadata[:email]
      current_state = aasm.current_state
      from_state = aasm.from_state
      to_state = aasm.to_state

      # Set submitted_by (id + email kept paired) coming from annotation step
      submitted_by_id, submitted_by_email =
        from_state == :annotate ? [account_id, account_email] : [@entry.submitted_by_id, @entry.submitted_by_email]

      # Set reviewed_by (id + email kept paired) coming from review step
      reviewed_by_id, reviewed_by_email =
        from_state == :review ? [account_id, account_email] : [@entry.reviewed_by_id, @entry.reviewed_by_email]

      # Resolve the next assignee (id + email snapshot kept paired)
      assigned_to_id, assigned_to_email =
        case from_state
        when :annotate
          # Moving to review step → assign to the reviewer (nil pair if unassigned)
          [reviewed_by_id, reviewed_by_email]
        when :review
          # Moving back to annotation → re-assign to the original annotator
          to_state == :annotate ? [submitted_by_id, submitted_by_email] : [nil, nil]
        end

      status =
        if current_state == :done
          "completed"
        else
          assigned_to_id ? "in_progress" : "pending"
        end

      entries.submit(
        entry.id,
        {
          wf_step: current_state.to_s,
          status:,
          assigned_to_id:,
          assigned_to_email:,
          submitted_by_id:,
          submitted_by_email:,
          reviewed_by_id:,
          reviewed_by_email:,
        }
      )
    end
  end
end
