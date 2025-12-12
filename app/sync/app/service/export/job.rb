# frozen_string_literal: true
module Export
  class Job < Jobs::Base
    def run_impl
      Verse::Util::Reflection.constantize(
        arguments.fetch(:process_class)
      ).new(
        Context::IdahApi.context(arguments.fetch(:context_args))
      ).run # arguments.fetch(:process_args) # or init ? or both ?
    end
  end
end
