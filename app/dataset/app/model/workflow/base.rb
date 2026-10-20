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

    # Steps a completed entry can be reopened to — excludes non-work states
    # (start pseudo-stage, done, error).
    def reopenable_steps
      aasm.states.map(&:name) - [:start, :done, :error]
    end
  end
end
