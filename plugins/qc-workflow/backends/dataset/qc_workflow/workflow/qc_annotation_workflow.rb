# frozen_string_literal: true

require "aasm"

module QcWorkflow
  module Workflow
    class QcAnnotationWorkflow < ::Workflow::Base
      # A custom workflow that integrates an automatic external QC step
      # between annotation and review.
      #
      # States: start → annotate → qc → review → done
      #           ↑          ↓        ↓
      #           └──────── review ──┘ (rejected)
      #
      # Events:
      # - submit (user-driven)         — start→annotate, annotate→qc, review→done/annotate
      # - resolve_external (callback)  — qc→review (called by the external app via workflow_callback)
      # - error (user-driven)          — any active step → error

      aasm do
        state :start, initial: true
        state :annotate
        state :qc
        state :review
        state :done
        state :error

        # User-driven transitions (frontend calls POST /entries/:id/submit)
        event :submit, after: :on_submit do
          transitions from: :start,    to: :annotate
          transitions from: :annotate, to: :qc
          transitions from: :review,   to: :done,     if: :approved?
          transitions from: :review,   to: :annotate, unless: :approved?
        end

        # Callback-driven transition (external app calls POST /entries/:id/workflow_callback)
        event :resolve_external, after: :on_submit do
          transitions from: :qc, to: :review
        end

        # Error transition (frontend calls POST /entries/:id/error)
        event :error do
          transitions from: [:annotate, :qc, :review], to: :error
        end
      end

      # ── Guard predicates ──────────────────────────────────────────

      def approved?
        unless @submit_opts.key?(:approved)
          raise Verse::Error::ValidationFailed, "Missing required option :approved for review step"
        end

        @submit_opts[:approved]
      end

      def allowed_note_feed?
        %w[annotate review].include?(@entry.wf_step)
      end

      def self.definition
        QcAnnotationDefinition
      end

      private

      # ── Callback ──────────────────────────────────────────────────

      def on_submit
        account_id = entries.auth_context.metadata[:id]
        current_state = aasm.current_state
        from_state = aasm.from_state
        to_state = aasm.to_state

        # Fire outbound call when transitioning annotate → qc
        if from_state == :annotate && to_state == :qc
          QcWorkflow::QcClient.call(@entry)
        end

        # Determine assignment based on transition
        assigned_to_id =
          case from_state
          when :start
            account_id
          when :annotate
            @entry.reviewed_by_id
          when :review
            to_state == :annotate ? @entry.submitted_by_id : nil
          when :qc
            @entry.reviewed_by_id
          end

        submitted_by_id = from_state == :annotate ? account_id : @entry.submitted_by_id

        reviewed_by_id =
          if %i[review qc].include?(from_state)
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