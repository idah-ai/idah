module Processor
  class Job < Jobs::Base
    def run_impl
      binding.pry
    end
  end
end
