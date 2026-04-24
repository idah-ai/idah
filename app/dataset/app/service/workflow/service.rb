# frozen_string_literal: true

module Workflow
  class Service < Verse::Service::Base
    def list_workflows
      workflows = []

      # Get all workflows from the registry
      Registry.list.each do |workflow_name, entries|
        # Get the first entry for this workflow
        workflow_entry = entries&.first
        next unless workflow_entry

        workflow_data = {
          name: workflow_name,
          plugin: workflow_entry.plugin,
          label: workflow_entry.klass.definition.label,
          description: workflow_entry.klass.definition.description,
          steps: workflow_entry.klass.definition.steps
        }

        workflows << workflow_data
      end

      { workflows: workflows }
    end
  end
end
