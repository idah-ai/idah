# frozen_string_literal: true

require "aasm"

module Workflow
  class Base
    include AASM

    attr_reader :entry, :submit_opts

    def initialize(entry, **opts)
      @entry = entry
      @submit_opts = opts
      # Initialize AASM with current state from entry
      aasm.current_state = entry.wf_step.to_sym if entry.wf_step
    end

    def new_state
      aasm.current_state
    end
  end
end
