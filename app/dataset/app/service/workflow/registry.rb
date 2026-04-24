# frozen_string_literal: true

module Workflow
  module Registry
    extend self

    @workflows = {}

    Entry = Data.define(:plugin, :klass)

    def register(plugin_name, workflow_name, klass:)
      workflow_name = workflow_name.to_sym
      @workflows[workflow_name] ||= []
      @workflows[workflow_name] <<
        Entry.new(
          plugin: plugin_name.to_sym,
          klass: klass
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
    end

    def get(name)
      # return default workflow if name is nil
      return Workflow::SimpleReviewAnnotationWorkflow if name.nil? || name == "default"

      name = name.to_sym
      entries = @workflows[name]
      return Workflow::SimpleReviewAnnotationWorkflow if entries.nil?

      entry = entries.first
      entry.klass
    end

    def list
      @workflows
    end
  end
end
