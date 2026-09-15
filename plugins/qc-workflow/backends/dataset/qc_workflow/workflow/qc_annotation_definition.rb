# frozen_string_literal: true

module QcWorkflow
  module Workflow
    class QcAnnotationDefinition
      def self.name
        "qc-annotation-workflow"
      end

      def self.label
        "QC Annotation Workflow"
      end

      def self.description
        "Annotation workflow with automatic external QC step."
      end

      def self.steps
        [
          { name: "start",     label: "Start", description: "Entry is ready for annotation" },
          { name: "annotate",  label: "Annotate",   description: "Annotate the entry" },
          { name: "qc",        label: "QC",         description: "External QC in progress — awaiting callback" },
          {
            name: "review",
            label: "Review",
            description: "Review the annotation and QC result",
            actions: [
              {
                name: "approved",
                choices: [
                  { label: "Approve", icon: "SquareCheckIcon", value: true },
                  { label: "Request Changes", icon: "SquareXIcon", value: false }
                ]
              }
            ]
          },
          { name: "done", label: "Done", description: "Annotation workflow completed" },
        ]
      end

      def self.allowed_note_feed
        %w[annotate review]
      end

      def self.external_steps
        %w[qc]
      end
    end
  end
end
