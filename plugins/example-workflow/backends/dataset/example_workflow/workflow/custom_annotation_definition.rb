# frozen_string_literal: true

module ExampleWorkflow
  module Workflow
    class CustomAnnotationDefinition
      def self.name
        "custom-annotation-workflow"
      end

      def self.label
        "Custom Annotation Workflow"
      end

      def self.description
        "A multi-step annotation workflow with review and final validation."
      end

      def self.steps
        [
          { name: "start", label: "Start", description: "Entry is ready for annotation" },
          { name: "annotate", label: "Annotate", description: "Annotate the entry" },
          {
            name: "review",
            label: "Review",
            description: "Review the annotation",
            actions: [
              { key: "approved", label: "Approve", icon: "SquareCheckIcon" },
              { key: "approved", label: "Request Changes", icon: "SquareXIcon" }
            ]
          },
          {
            name: "final_check",
            label: "Final Check",
            description: "Final check before completion",
            actions: [
              { key: "final_approved", label: "Approve Final Check", icon: "SquareCheckIcon" },
              { key: "final_approved", label: "Request Changes in Final Check", icon: "SquareXIcon" }
            ]
          },
          { name: "done", label: "Done", description: "Annotation workflow completed" },
        ]
      end

      def self.allowed_note_feed
        ["annotate", "review", "final_check"]
      end
    end
  end
end
