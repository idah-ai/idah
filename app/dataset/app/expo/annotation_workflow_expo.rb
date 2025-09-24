# frozen_string_literal: true

class AnnotationWorkflowExpo < BaseExpo
  http_path "/annotation_workflow"

  use_service AnnotationWorkflow::Service

  # Start annotation workflow for an entry
  expose on_http(:post, "/start", auth: nil) do
    desc "Start annotation workflow for an entry"
    input do
      field :data, Hash do
        field :attributes, Hash do
          field :entry_id, String
        end
      end
    end
  end
  def start_annotation
    entry_id = params.dig(:data, :attributes, :entry_id)

    service.start_annotation(entry_id)
  end

  # Submit annotation data from editor
  expose on_http(:post, "/submit", auth: nil) do
    desc "Submit annotation data from annotator editor"
    input do
      field :data, Hash do
        field :attributes, Hash do
          field :entry_id, String
          field :annotator_id, Integer
          field :annotation_data, Array
        end
      end
    end
  end
  def submit_annotation
    entry_id = params.dig(:data, :attributes, :entry_id)
    annotator_id = params.dig(:data, :attributes, :annotator_id)
    annotation_data = params.dig(:data, :attributes, :annotation_data)

    service.submit_annotation(entry_id, annotation_data, annotator_id)
  end

  # Get workflow status for an entry
  expose on_http(:get, "/status/:entry_id", auth: nil) do
    desc "Get workflow status for an entry"
    input do
      field :entry_id, String
    end
  end
  def get_workflow_status
    entry_id = params[:entry_id]

    service.get_workflow_status(entry_id)
  end

  # Reset workflow for error recovery
  expose on_http(:post, "/reset", auth: nil) do
    desc "Reset workflow for an entry"
    input do
      field :data, Hash do
        field :attributes, Hash do
          field :entry_id, String
        end
      end
    end
  end
  def reset_workflow
    entry_id = params.dig(:data, :attributes, :entry_id)

    service.reset_workflow(entry_id)
  end
end
