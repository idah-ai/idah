# frozen_string_literal: true

module Workflow
  module Registry
    extend self

    @workflows = {}
    @default_workflow = nil

    Entry = Data.define(:plugin, :class_name)

    def register(plugin_name, workflow_name, class_name:)
      workflow_name = workflow_name.to_sym
      @workflows[workflow_name] ||= []
      @workflows[workflow_name] <<
        Entry.new(
          plugin: plugin_name.to_sym,
          class_name:
        )
    end

    def clear(plugin_name)
      plugin_name = plugin_name.to_sym
      @workflows.each_value do |coll|
        coll.reject! { |entry| entry.plugin == plugin_name }
      end
    end

    def clear_all
      @workflows.clear
      @default_workflow = nil
    end

    def get(name)
      return default_workflow if name.nil?

      name = name.to_sym
      entries = @workflows[name]
      return default_workflow if entries.nil? || entries.empty?

      entry = entries.first
      Object.const_get(entry.class_name)
    end

    def register_default(workflow_class)
      @default_workflow = workflow_class
    end

    def default_workflow
      @default_workflow || Workflow::SimpleReviewAnnotationWorkflow
    end

    def list
      @workflows.keys
    end
  end
end
