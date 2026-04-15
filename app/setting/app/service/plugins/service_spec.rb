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
                  icon: "SquareCheckIcon",
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

      annotate_plugin = PluginSystem::Plugin.new(
        "path_to_foo",
        PluginSystem::Manifest.new(
          type: "idah-plugin",
          name: "annotate",
          version: "1.0.0",
          title: "Annotate plugin",
          description: "Annotate test plugin",
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
                      label: "Quality Approved",
                      icon: "StarIcon",
                    }
                  ]
                }
              ]
            }
          ],
          entryPoints: {}
        )
      )

      verify_plugin = PluginSystem::Plugin.new(
        "path_to_bar",
        PluginSystem::Manifest.new(
          type: "idah-plugin",
          name: "verify",
          version: "1.0.0",
          title: "Verify plugin",
          description: "Verify test plugin",
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
                    },
                    {
                      name: "comments",
                      label: "Comments"
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
          "annotate" => annotate_plugin,
          "verify" => verify_plugin
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

      # Check annotate plugin workflow
      annotate_workflow = output[:workflows].find { |w| w[:name] == "custom_workflow" }
      expect(annotate_workflow).not_to be_nil
      expect(annotate_workflow[:label]).to eq("Custom Workflow")
      expect(annotate_workflow[:description]).to eq("A custom annotation workflow")
      expect(annotate_workflow[:plugin]).to eq("annotate")
      expect(annotate_workflow[:default]).to be false
      expect(annotate_workflow[:steps].length).to eq(1)

      annotate_step = annotate_workflow[:steps].first
      expect(annotate_step[:name]).to eq("annotate")
      expect(annotate_step[:label]).to eq("Annotate")
      expect(annotate_step[:description]).to eq("Annotate the data")
      expect(annotate_step[:actions].length).to eq(1)

      expect(annotate_step[:actions].first).to eq(
        {
          name: "quality",
          label: "Quality Approved",
          icon: "StarIcon",
        }
      )

      # Check verify plugin workflow
      verify_workflow = output[:workflows].find { |w| w[:name] == "review_workflow" }
      expect(verify_workflow).not_to be_nil
      expect(verify_workflow[:label]).to eq("Review Workflow")
      expect(verify_workflow[:description]).to eq("A review-focused workflow")
      expect(verify_workflow[:plugin]).to eq("verify")
      expect(verify_workflow[:default]).to be false
      expect(verify_workflow[:steps].length).to eq(1)

      verify_step = verify_workflow[:steps].first
      expect(verify_step[:name]).to eq("verify")
      expect(verify_step[:actions].length).to eq(2)

      expect(verify_step[:actions].find { |a| a[:name] == "verified" }).to eq(
        {
          name: "verified",
          label: "Verified"
        }
      )

      expect(verify_step[:actions].find { |a| a[:name] == "comments" }).to eq(
        {
          name: "comments",
          label: "Comments"
        }
      )
    end
  end
end
