# frozen_string_literal: true

module QcWorkflow
  class Dataset
    def self.init(context)
      # Register the QC workflow for this plugin
      context.register_workflow(
        "qc-annotation-workflow",
        klass: QcWorkflow::Workflow::QcAnnotationWorkflow
      )
    end
  end
end
