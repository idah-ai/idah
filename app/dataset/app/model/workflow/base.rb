# frozen_string_literal: true

require "aasm"

module Workflow
  class Base
    include AASM

    attr_reader :entries, :entry, :submit_opts

    def initialize(entries, entry, **opts)
      @entries = entries
      @entry = entry
      @submit_opts = opts
      # Initialize AASM with current state from entry
      aasm.current_state = entry.wf_step.to_sym if entry.wf_step
    end

    def new_state
      aasm.current_state
    end

    # Stage entries are moved back to when reopened. Subclasses should override
    # to return the actual first work stage (e.g. :annotate).
    def first_workflow_step
      aasm.states.map(&:name).find { |s| s != :start } || aasm.initial_state
    end

    # Returns an [id, email] pair for the member who performed the first
    # workflow stage — used as the assignee when an entry is reopened.
    # Override in custom workflows; default returns [nil, nil].
    def first_stage_assignee
      [nil, nil]
    end
  end
end
