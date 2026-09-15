# frozen_string_literal: true

class WorkflowsExpo < BaseExpo
  http_path "/workflows"

  use_service Workflow::Service

  desc <<~MD
    Workflows define the sequence of steps for annotating and reviewing entries within a dataset.
  MD

  expose on_http(
    :get,
    "",
    auth: nil
  ) do
    output do
      field :data, Hash do
        field(:workflows, Hash).meta(description: "List of available workflows from plugins")
      end
    end
  end
  def index
    service.list_workflows
  end
end
