# frozen_string_literal: true

require_relative "base"

class Workflow::Entry < Workflow::Base
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
    @entry.dataset.workflow_configuration.dig("sample_rate") || 1
  end

  def should_sample?
    rand < sample_rate
  end

  def approved?
    @submit_opts[:approved]
  end
end
