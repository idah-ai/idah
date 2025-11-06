# frozen_string_literal: true

module Processor
  class Job < Jobs::Base
    attr_reader :entry_id, :processor_class, :options_class

    def run_impl
      @entry_id = arguments.fetch(:entry_id)

      processor_class_name = arguments.fetch(:processor_class_name)
      options_class_name   = arguments.fetch(:options_class_name)
      options = arguments.fetch(:options, {})

      processor_class = Verse::Util::Reflection.constantize(
        processor_class_name
      )

      options_class = Verse::Util::Reflection.constantize(
        options_class_name
      )

      # Generate the context
      context = Processor::Context.new(
        Verse::Auth::Context.new,
        self,
        arguments.fetch(:resource),
        options_class.new(**options)
      )

      processor_instance = processor_class.new(context)
      processor_instance.run
    end
  end
end
