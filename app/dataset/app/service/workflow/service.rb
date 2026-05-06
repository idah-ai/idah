# frozen_string_literal: true

module Workflow
  class Service < Verse::Service::Base
    def list_workflows
      workflows = Registry.definitions.map do |wf|
        {
          name: wf[:name],
          plugin: wf[:plugin],
          label: wf[:definition].label,
          description: wf[:definition].description,
          steps: wf[:definition].steps
        }
      end

      { workflows: workflows }
    end
  end
end
