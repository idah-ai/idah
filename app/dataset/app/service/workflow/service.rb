# frozen_string_literal: true

module Workflow
  class Service < Verse::Service::Base
    def list_workflows
      workflows = []

      # Add workflows from plugins
      PluginSystem.registry.plugins.each do |plugin_name, plugin|
        next unless plugin.workflows

        plugin.workflows.each do |workflow|
          workflow_data = {
            name: workflow.name,
            label: workflow.label,
            description: workflow.description,
            plugin: plugin_name,
            default: false
          }

          if workflow.respond_to?(:steps) && workflow.steps
            workflow_data[:steps] = workflow.steps.map do |step|
              step_data = {
                name: step.name,
                label: step.label,
                description: step.description
              }

              if step.respond_to?(:actions) && step.actions
                step_data[:actions] = step.actions.map do |action|
                  action_data = {
                    name: action.name,
                    label: action.label,
                  }
                  action_data[:icon] = action.icon if action.respond_to?(:icon) && action.icon
                  action_data
                end
              end

              step_data
            end
          end

          workflows << workflow_data
        end
      end

      { workflows: workflows }
    end
  end
end
