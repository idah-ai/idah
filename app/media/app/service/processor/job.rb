# frozen_string_literal: true

module Processor
  class Job < Jobs::Base
    def run_impl
      arguments[:entry_id]
      processor = arguments[:processor]
      options_class = arguments[:options_class]

      processor_class = Verse::Util::Reflection.constantize(
        processor
      )
      options_class = Verse::Util::Reflection.constantize(
        options_class
      )

      # Generate the context
      context = Processor::Context.new(
        Verse::Auth::Context.new,
        self,
        arguments[:resource],
        options_class.new(
          **arguments[:options]
        )
      )

      processor_instance = processor_class.new(context)
      processor_instance.run
    end
  end
end
