# frozen_string_literal: true

RSpec.describe Plugins::Service, type: :service, as: :system do
  describe "#serve_file" do
    it "serves the plugin file if found (manual)" do
      plugin_name = "fake_plugin"

      allow(Verse.config).to receive(:extra_fields).and_return(
        idah: {
          plugins: {
            manual: [plugin_name],
            path: "app/spec_data"
          }
        }
      )

      filename = "plugin.js"

      output = service.serve_file(plugin_name, filename)

      expect(output).to eq("/* I am a javascript plugin file */")
    end
  end

  describe "#serve_asset" do
    it "serves the asset file present in asset directory" do
      plugin_name = "fake_plugin"

      allow(Verse.config).to receive(:extra_fields).and_return(
        idah: {
          plugins: {
            manual: [plugin_name],
            path: "app/spec_data"
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
