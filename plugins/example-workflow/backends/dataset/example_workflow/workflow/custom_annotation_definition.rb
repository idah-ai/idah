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
              {
                name: "approved",
                choices: [
                  { label: "Approve", icon: "SquareCheckIcon", value: true },
                  { label: "Request Changes", icon: "SquareXIcon", value: false }
                ]
              }
            ]
          },
          {
            name: "final_check",
            label: "Final Check",
            description: "Final check before completion",
            actions: [
              {
                name: "final_approved",
                choices: [
                  { label: "Approve Final Check", icon: "SquareCheckIcon", value: true },
                  { label: "Request Changes in Final Check", icon: "SquareXIcon", value: false }
                ]
              }
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
