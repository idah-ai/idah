# frozen_string_literal: true
module Export
  class Job < Jobs::Base
    attr_reader :dataset_id

    def run_impl
      Verse::Util::Reflection.constantize(
        arguments.fetch(:process_class)
      ).new(
        IdahApiContext::Root.from(arguments.fetch(:process_args))
      ).run # arguments.fetch(:process_args) # or init ? or both ?
    end
  end
end
