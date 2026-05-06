# frozen_string_literal: true

module ExampleWorkflow
  class Dataset
    def self.init(context)
      # Register the custom workflow for this plugin
      context.register_workflow(
        "custom-annotation-workflow",
        klass: ExampleWorkflow::Workflow::CustomAnnotationWorkflow
      )
    end
  end
end
