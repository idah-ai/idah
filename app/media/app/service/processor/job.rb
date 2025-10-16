# frozen_string_literal: true

module Processor
  class Job < Jobs::Base
    def run_impl
      raise NotImplementedError, "Implement Processor::Job"
    end
  end
end
