require "spec_helper"

require_relative "./manifest"

RSpec.describe PluginSystem::Manifest do
  let(:valid_manifest) do
    <<-JSON
    {
      "type": "idah-plugin",
      "name": "idah-video",
      "version": "1.0.0",

      "title": "IDAH Video Annotation",
      "description": "A module for annotating video.",

      "repository": {
        "type": "git",
        "url": ""
      },

      "entryPoints": {
        "entryPlugin": {
          "script": "frontend/build/build.js",
          "style": "frontend/build/build.css"
        },
        "entryDetails": {
          "script": "frontend/build/entryDetailsBuild.js",
          "style": "frontend/build/entryDetailsBuild.css"
        },
        "datasetConfig": "config/dataset.json",
        "pluginShortcut": "config/shortcut.json",
        "assetsDirectory": "assets",
        "backend": {
          "module": "IdahVideo",
          "path": "backends"
        }
      }
    }
    JSON
  end

  let(:invalid_manifest) do
    "{}"
  end

  describe "validation" do
    it "valid manifest passes validation" do
      data = JSON.parse(valid_manifest)
      result = PluginSystem::ManifestSchema.validate(data)
      expect(result.errors).to be_empty
    end

    it "invalid manifest fails validation" do
      data = JSON.parse(invalid_manifest)
      result = PluginSystem::ManifestSchema.validate(data)
      expect(result.errors.keys).to include(
        :entryPoints, :type, :name, :version, :title, :entryPoints
      )
    end
  end
end