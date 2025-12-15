# frozen_string_literal: true
module Export
  class Job < Jobs::Base
    def run_impl
      Verse::Util::Reflection.constantize(
        arguments.fetch(:io_class)
      ).prepare(arguments.fetch(:io_args)) do |io|
        Verse::Util::Reflection.constantize(
          arguments.fetch(:process_class)
        ).new(
          Context::root(io, arguments.fetch(:context_args))
        ).run # arguments.fetch(:process_args) # or init ? or both ?
      end
    end
  end
end
