# frozen_string_literal: true
module Export
  class Job < Jobs::Base
    def run_impl
      Verse::Util::Reflection.constantize(
        arguments.fetch(:file_class)
      ).prepare([:export, Time.now.to_i]) do |file|
        Verse::Util::Reflection.constantize(
          arguments.fetch(:process_class)
        ).new(
          Context::root(file, arguments.fetch(:context_args))
        ).run # arguments.fetch(:process_args) # or init ? or both ?
      end
    end
  end
end
