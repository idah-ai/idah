module Processor
  class Job < Jobs::Base
    def run_impl
      arguments[]
    end
  end
end
