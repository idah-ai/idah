# frozen_string_literal: true

RSpec.describe Plugins::Service, type: :service, as: :system do
  describe "#serve_file" do
    let(:plugin_name) { "fake_plugin" }

    before do
      allow(Verse.config).to receive(:extra_fields).and_return(
        idah: {
          plugins: {
            path: "app/spec_data/**"
          }
        }
      )
    end

    it "serves the plugin.js file if found (manual)" do
      filename = "plugin.js"

      output = service.serve_file(plugin_name, filename)

      expect(output).to eq("/* I am a javascript plugin file */")
    end

    it "serves the details.js file when requested" do
      filename = "details.js"

      output = service.serve_file(plugin_name, filename)

      expect(output).to eq("/* I am a javascript plugin file */")
    end

    it "serves the details.css file when requested" do
      filename = "details.css"

      output = service.serve_file(plugin_name, filename)

      expect(output).not_to be_nil
    end

    it "serves the dataset_config.json file when requested" do
      filename = "dataset_config.json"

      output = service.serve_file(plugin_name, filename)

      expect(output).to include("Fake Dataset Config")
      expect(output).to include("Test dataset configuration")
    end

    it "serves the plugin_shortcut.json file when requested" do
      filename = "plugin_shortcut.json"

      output = service.serve_file(plugin_name, filename)

      expect(output).to include("shortcuts")
      expect(output).to include("ctrl+p")
    end
  end

  describe "#serve_asset" do
    it "serves the asset file present in asset directory" do
      plugin_name = "fake_plugin"

      allow(Verse.config).to receive(:extra_fields).and_return(
        idah: {
          plugins: {
            path: "app/spec_data/**"
          }
        }
      )

      filename = "image.png"

      io = service.serve_asset(plugin_name, filename)
      expect(io.read).to eq("PNG IMAGE DATA")
    end
  end

  describe "#show_modalities" do
    it "shows modalities from all plugins" do
      registry = double("PluginSystem.registry")

      foo_plugin = PluginSystem::Plugin.new(
        "path_to_foo",
        PluginSystem::Manifest.new(
          type: "idah-plugin",
          name: "foo",
          version: "1.0.0",
          title: "Foo plugin",
          description: "Foo ipsum",
          modalities: [{ id: "modA", label: "modality A", description: "" }, { id: "modB", label: "modality B" }],
          entryPoints: {}
        )
      )

      bar_plugin = PluginSystem::Plugin.new(
        "path_to_bar",
        PluginSystem::Manifest.new(
          type: "idah-plugin",
          name: "bar",
          version: "1.0.0",
          title: "Bar plugin",
          description: "Bar ipsum",
          modalities: [{ id: "modB" }, { id: "modC" }],
          entryPoints: {}
        )
      )

      allow(registry).to receive(:plugins).and_return(
        {
          "foo" => foo_plugin,
          "bar" => bar_plugin
        }
      )

      allow(PluginSystem).to receive(:registry).and_return(registry)

      output = service.show_modalities

      expect(output).to eq(
        {
          modalities: {
            "modA" => { label: "modality A", description: "" },
            "modB" => { label: "modality B", description: nil },
            "modC" => { label: nil, description: nil }
          },
          plugins: {
            "modA" => ["foo"],
            "modB" => ["foo", "bar"],
            "modC" => ["bar"]
          }
        }
      )
    end
  end

  describe "#show_modality" do
    it "shows shapes for a given modality" do
      registry = double("PluginSystem.registry")

      foo_plugin = PluginSystem::Plugin.new(
        "path_to_foo",
        PluginSystem::Manifest.new(
          type: "idah-plugin",
          name: "foo",
          version: "1.0.0",
          title: "Foo plugin",
          description: "Foo ipsum",
          modalities: [{
            id: "modA",
            label: "modality A",
            description: "",
            shapes: {
              "shapeA" => { label: "Shape A", icon: "iconA.svg" }
            }
          }],
          entryPoints: {}
        )
      )

      bar_plugin = PluginSystem::Plugin.new(
        "path_to_bar",
        PluginSystem::Manifest.new(
          type: "idah-plugin",
          name: "bar",
          version: "1.0.0",
          title: "Bar plugin",
          description: "Bar ipsum",
          modalities: [{
            id: "modA",
            shapes: {
              "shapeB" => { label: "Shape B", icon: "iconB.svg" }
            }
          }],
          entryPoints: {}
        )
      )

      allow(registry).to receive(:plugins).and_return(
        {
          "foo" => foo_plugin,
          "bar" => bar_plugin
        }
      )

      allow(PluginSystem).to receive(:registry).and_return(registry)

      output = service.show_modality("modA")

      expect(output).to eq(
        { shapes: {
          shapeA: { label: "Shape A", icon: "iconA.svg" },
          shapeB: { label: "Shape B", icon: "iconB.svg" }
        } }
      )
    end
  end

  describe "#show_workflows" do
    it "returns default workflow when no plugin workflows exist" do
      registry = double("PluginSystem.registry")

      allow(registry).to receive(:plugins).and_return({})
      allow(PluginSystem).to receive(:registry).and_return(registry)

      output = service.show_workflows

      expect(output[:workflows]).to be_an(Array)
      expect(output[:workflows].length).to eq(1)

      default_workflow = output[:workflows].first
      expect(default_workflow).to eq(
        {
          name: "default",
          label: "Default Workflow",
          description: "Default workflow with annotation and review steps",
          plugin: "core",
          default: true,
          steps: [
            {
              name: "review",
              label: "Review",
              actions: [
                {
                  name: "approved",
                  label: "Approve",
                  type: "boolean",
                  icon: "SquareCheckIcon",
                  required: true
                }
              ],
              description: "Review the annotations"
            }
          ]
        }
      )
    end

    it "returns workflows from plugins along with default workflow" do
      registry = double("PluginSystem.registry")

      foo_plugin = PluginSystem::Plugin.new(
        "path_to_foo",
        PluginSystem::Manifest.new(
          type: "idah-plugin",
          name: "foo",
          version: "1.0.0",
          title: "Foo plugin",
          description: "Foo ipsum",
          workflows: [
            {
              name: "custom_workflow",
              label: "Custom Workflow",
              description: "A custom annotation workflow",
              steps: [
                {
                  name: "annotate",
                  label: "Annotate",
                  description: "Annotate the data",
                  actions: [
                    {
                      name: "quality",
                      label: "Quality Score",
                      type: "select",
                      icon: "StarIcon",
                      options: ["high", "medium", "low"],
                      required: true
                    }
                  ]
                }
              ]
            }
          ],
          entryPoints: {}
        )
      )

      bar_plugin = PluginSystem::Plugin.new(
        "path_to_bar",
        PluginSystem::Manifest.new(
          type: "idah-plugin",
          name: "bar",
          version: "1.0.0",
          title: "Bar plugin",
          description: "Bar ipsum",
          workflows: [
            {
              name: "review_workflow",
              label: "Review Workflow",
              description: "A review-focused workflow",
              steps: [
                {
                  name: "verify",
                  label: "Verify",
                  description: "Verify the annotations",
                  actions: [
                    {
                      name: "verified",
                      label: "Verified",
                      type: "boolean",
                      required: false
                    },
                    {
                      name: "comments",
                      label: "Comments",
                      type: "text",
                      defaultValue: "No issues found"
                    }
                  ]
                }
              ]
            }
          ],
          entryPoints: {}
        )
      )

      allow(registry).to receive(:plugins).and_return(
        {
          "foo" => foo_plugin,
          "bar" => bar_plugin
        }
      )

      allow(PluginSystem).to receive(:registry).and_return(registry)

      output = service.show_workflows

      expect(output[:workflows]).to be_an(Array)
      expect(output[:workflows].length).to eq(3)

      # Check default workflow is first
      expect(output[:workflows][0][:name]).to eq("default")
      expect(output[:workflows][0][:default]).to be true
      expect(output[:workflows][0][:plugin]).to eq("core")

      # Check foo plugin workflow
      foo_workflow = output[:workflows].find { |w| w[:name] == "custom_workflow" }
      expect(foo_workflow).not_to be_nil
      expect(foo_workflow[:label]).to eq("Custom Workflow")
      expect(foo_workflow[:description]).to eq("A custom annotation workflow")
      expect(foo_workflow[:plugin]).to eq("foo")
      expect(foo_workflow[:default]).to be false
      expect(foo_workflow[:steps].length).to eq(1)

      annotate_step = foo_workflow[:steps].first
      expect(annotate_step[:name]).to eq("annotate")
      expect(annotate_step[:label]).to eq("Annotate")
      expect(annotate_step[:description]).to eq("Annotate the data")
      expect(annotate_step[:actions].length).to eq(1)

      expect(annotate_step[:actions].first).to eq(
        {
          name: "quality",
          label: "Quality Score",
          type: "select",
          icon: "StarIcon",
          options: ["high", "medium", "low"],
          required: true
        }
      )

      # Check bar plugin workflow
      bar_workflow = output[:workflows].find { |w| w[:name] == "review_workflow" }
      expect(bar_workflow).not_to be_nil
      expect(bar_workflow[:label]).to eq("Review Workflow")
      expect(bar_workflow[:description]).to eq("A review-focused workflow")
      expect(bar_workflow[:plugin]).to eq("bar")
      expect(bar_workflow[:default]).to be false
      expect(bar_workflow[:steps].length).to eq(1)

      verify_step = bar_workflow[:steps].first
      expect(verify_step[:name]).to eq("verify")
      expect(verify_step[:actions].length).to eq(2)

      expect(verify_step[:actions].find { |a| a[:name] == "verified" }).to eq(
        {
          name: "verified",
          label: "Verified",
          type: "boolean",
          required: false
        }
      )

      expect(verify_step[:actions].find { |a| a[:name] == "comments" }).to eq(
        {
          name: "comments",
          label: "Comments",
          type: "text",
          required: false,
          default_value: "No issues found"
        }
      )
    end

    # it "handles plugins without workflows gracefully" do
    #   registry = double("PluginSystem.registry")

    #   plugin_without_workflows = PluginSystem::Plugin.new(
    #     "path_to_plugin",
    #     PluginSystem::Manifest.new(
    #       type: "idah-plugin",
    #       name: "no-workflow-plugin",
    #       version: "1.0.0",
    #       title: "Plugin without workflows",
    #       description: "This plugin has no workflows",
    #       entryPoints: {}
    #     )
    #   )

    #   plugin_with_workflow = PluginSystem::Plugin.new(
    #     "path_to_plugin2",
    #     PluginSystem::Manifest.new(
    #       type: "idah-plugin",
    #       name: "with-workflow-plugin",
    #       version: "1.0.0",
    #       title: "Plugin with workflows",
    #       description: "This plugin has workflows",
    #       workflows: [
    #         {
    #           name: "simple_workflow",
    #           label: "Simple Workflow",
    #           description: "A simple workflow"
    #         }
    #       ],
    #       entryPoints: {}
    #     )
    #   )

    #   allow(registry).to receive(:plugins).and_return(
    #     {
    #       "no-workflow-plugin" => plugin_without_workflows,
    #       "with-workflow-plugin" => plugin_with_workflow
    #     }
    #   )

    #   allow(PluginSystem).to receive(:registry).and_return(registry)

    #   output = service.show_workflows

    #   expect(output[:workflows].length).to eq(2) # default + one from plugin
    #   workflow_names = output[:workflows].map { |w| w[:name] }
    #   expect(workflow_names).to include("default", "simple_workflow")
    #   expect(workflow_names).not_to include("no-workflow-plugin")
    # end

    # it "handles workflows with minimal step and action definitions" do
    #   registry = double("PluginSystem.registry")

    #   minimal_plugin = PluginSystem::Plugin.new(
    #     "path_to_minimal",
    #     PluginSystem::Manifest.new(
    #       type: "idah-plugin",
    #       name: "minimal",
    #       version: "1.0.0",
    #       title: "Minimal plugin",
    #       description: "Minimal workflow definition",
    #       workflows: [
    #         {
    #           name: "minimal_workflow",
    #           label: "Minimal Workflow",
    #           steps: [
    #             {
    #               name: "step1",
    #               label: "Step 1",
    #               actions: [
    #                 {
    #                   name: "action1",
    #                   label: "Action 1",
    #                   type: "boolean"
    #                 }
    #               ]
    #             }
    #           ]
    #         }
    #       ],
    #       entryPoints: {}
    #     )
    #   )

    #   allow(registry).to receive(:plugins).and_return(
    #     { "minimal" => minimal_plugin }
    #   )

    #   allow(PluginSystem).to receive(:registry).and_return(registry)

    #   output = service.show_workflows

    #   minimal_workflow = output[:workflows].find { |w| w[:name] == "minimal_workflow" }
    #   expect(minimal_workflow).not_to be_nil
    #   expect(minimal_workflow[:description]).to be_nil
    #   expect(minimal_workflow[:plugin]).to eq("minimal")

    #   step = minimal_workflow[:steps].first
    #   expect(step[:description]).to be_nil

    #   action = step[:actions].first
    #   expect(action[:icon]).to be_nil
    #   expect(action[:options]).to be_nil
    #   expect(action.key?(:required)).to be false
    #   expect(action.key?(:default_value)).to be false
    # end
  end
end
