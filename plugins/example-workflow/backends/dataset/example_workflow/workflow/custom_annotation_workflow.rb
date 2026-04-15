# frozen_string_literal: true

require "aasm"

module ExampleWorkflow
  module Workflow
    class CustomAnnotationWorkflow < ::Workflow::Base
      # This is an example custom workflow that extends the base workflow
      # It demonstrates a different annotation flow than SimpleReviewAnnotationWorkflow

      aasm do
        state :start, initial: true
        state :annotate
        state :review
        state :final_check
        state :done
        state :error

        # Transition from start to annotation phase
        event :submit, after: :on_submit do
          transitions from: :start, to: :annotate

          # After annotation, always goes to review
          transitions from: :annotate, to: :review

          # After review, can go to final check or back to annotation
          transitions from: :review, to: :final_check, if: :approved?
          transitions from: :review, to: :annotate, unless: :approved?

          # After final check, either done or back to review
          transitions from: :final_check, to: :done, if: :final_approved?
          transitions from: :final_check, to: :review, unless: :final_approved?
        end

        event :error do
          transitions from: [:annotate, :review, :final_check], to: :error
        end
      end

      def approved?
        unless @submit_opts.key?(:approved)
          raise Verse::Error::ValidationFailed, "Missing required option :approved for review step"
        end

        @submit_opts[:approved]
      end

      def final_approved?
        unless @submit_opts.key?(:final_approved)
          raise Verse::Error::ValidationFailed, "Missing required option :final_approved for final_check step"
        end

        @submit_opts[:final_approved]
      end

      def allowed_note_feed?
        # Allow note feeds in all steps except start and done
        ["annotate", "review", "final_check"].include?(@entry.wf_step)
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
            @entry.reviewed_by_id
          when :review
            to_state == :annotate ? @entry.submitted_by_id : @entry.reviewed_by_id
          when :final_check
            @entry.reviewed_by_id if to_state == :review
          end

        # Set submitted_by_id when coming from annotation step
        submitted_by_id = from_state == :annotate ? account_id : @entry.submitted_by_id

        # Set reviewed_by_id when coming from review or final_check
        reviewed_by_id =
          if [:review, :final_check].include?(from_state)
            account_id
          else
            @entry.reviewed_by_id
          end

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
end
