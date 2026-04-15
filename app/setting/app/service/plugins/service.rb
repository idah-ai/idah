# frozen_string_literal: true

module Plugins
  class Service < Verse::Service::Base
    use repo: Plugin::Repository

    def install(_plugin_name)
      Manager.run do
        install_plugin
      end
    end

    def find(plugin_name)
      plugin_path = Verse.config.extra_fields.dig(
        :idah, :plugins, :path
      ) || "plugins/**"

      plugin_path.split(";").each do |path|
        Dir.glob(path).each do |dir|
          name = dir.split("/").last

          next unless name == plugin_name

          return Plugin::Record.from_path(dir)
        end
      end

      # 2. if manual plugin not found, check in the database
      repo.find_by({ name: plugin_name })
    end

    def serve_asset(plugin_name, filename)
      plugin = find(plugin_name)

      manifest = plugin&.manifest
      return nil unless manifest

      assets_directory = manifest.entry_points&.assets_directory
      return nil unless assets_directory

      asset_path = File.join(
        plugin.path,
        assets_directory,
        filename
      )

      return nil unless File.exist?(asset_path)

      File.open(asset_path, "rb")
    end

    # Return a hash in the form of:
    #
    # {
    #   modalities: { id: {label: "...", description: "..."} },
    #   plugins: { "modA": ["plugin1", "plugin2"], ... }
    # }
    def show_modalities
      output = {
        modalities: {},
        plugins: {}
      }

      PluginSystem.registry.plugins.each do |name, plugin|
        modalities = plugin.modalities
        next unless modalities

        modalities.each do |mod|
          mod_id = mod.id
          mod_hash = (output[:modalities][mod_id] ||= {})
          mod_hash[:label] ||= mod.label
          mod_hash[:description] ||= mod.description

          plugin_arr = (output[:plugins][mod_id] ||= [])
          plugin_arr << name
        end
      end

      output
    end

    def show_modality(modality_name)
      shapes = {}

      PluginSystem.registry.plugins.each_value do |plugin|
        next unless plugin.modalities

        plugin.modalities.each do |mod|
          next unless mod.id == modality_name
          next unless mod.shapes

          shapes.merge!(mod.shapes.transform_values(&:to_h))
        end
      end

      { shapes: }
    end

    def show_workflows
      workflows = []

      # Add the default workflow first
      workflows << {
        name: "default",
        label: "Default Workflow",
        description: "Default workflow with annotation and review steps",
        plugin: "core",
        default: true,
        steps: [
          {
            name: "review",
            label: "Review",
            description: "Review the annotations",
            actions: [
              {
                name: "approved",
                label: "Approve",
                icon: "SquareCheckIcon"
              }
            ]
          }
        ]
      }

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

      { workflows: }
    end

    def serve_file(plugin_name, filename)
      plugin = find(plugin_name)

      manifest = plugin&.manifest
      return nil if manifest.nil?

      file_path = \
        case filename
        when "plugin.js", "plugin.css"
          entry_plugin = manifest.entry_points&.entry_plugin
          return nil unless entry_plugin

          is_style = filename.end_with?(".css")
          if is_style
            entry_plugin.style
          else
            entry_plugin.script
          end
        when "details.js", "details.css"
          entry_details = manifest.entry_points&.entry_details
          return nil unless entry_details

          is_style = filename.end_with?(".css")

          if is_style
            entry_details.style
          else
            entry_details.script
          end
        when "dataset_config.json"
          manifest.entry_points&.dataset_config
        when "plugin_shortcut.json"
          manifest.entry_points&.plugin_shortcut
        end

      return nil if file_path.nil?

      return unless file_path

      # binding.pry
      File.read(
        File.join(plugin.path, file_path)
      )
    end
  end
end
