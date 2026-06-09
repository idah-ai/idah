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
end
