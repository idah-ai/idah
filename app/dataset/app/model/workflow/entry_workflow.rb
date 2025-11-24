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
      event :submit do
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
  end
end
