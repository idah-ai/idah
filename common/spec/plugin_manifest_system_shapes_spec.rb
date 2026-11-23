# frozen_string_literal: true

require "spec_helper"

require_relative "../lib/plugin_system/manifest"

# `ci-common.yml` runs `common/spec/` only, so the `systemShapes` specs cannot
# live in `common/lib/plugin_system/manifest_spec.rb` (lib specs never run in
# CI). See the same note in plugin_manifest_args_spec.rb.
RSpec.describe "PluginSystem::Manifest with system shapes" do
  def manifest_with(modalities)
    data = JSON.parse(<<~JSON)
      {
        "type": "idah-plugin",
        "name": "fixture",
        "version": "1.0.0",
        "title": "Fixture",
        "entryPoints": {}
      }
    JSON

    data["modalities"] = modalities
    PluginSystem::Manifest.new(data)
  end

  it "parses systemShapes on a modality, deep-symbolized" do
    manifest = manifest_with(
      [
        {
          "id" => "idah-image",
          "label" => "Image",
          "systemShapes" => {
            "done-area" => { "label" => "Done Area" }
          }
        }
      ]
    )

    system_shapes = manifest.modalities.first.system_shapes
    expect(system_shapes.keys).to eq([:"done-area"])
    expect(system_shapes[:"done-area"].label).to eq("Done Area")
  end

  it "leaves system_shapes nil when a modality declares none" do
    manifest = manifest_with([{ "id" => "idah-image", "label" => "Image" }])
    expect(manifest.modalities.first.system_shapes).to be_nil
  end

  it "rejects a non-Hash systemShapes" do
    expect {
      manifest_with(
        [
          {
            "id" => "idah-image",
            "systemShapes" => "done-area"
          }
        ]
      )
    }.to raise_error(Verse::Schema::InvalidSchemaError, /system_shapes.*must be a hash/)
  end
end
