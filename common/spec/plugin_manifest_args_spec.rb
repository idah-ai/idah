# frozen_string_literal: true

require "spec_helper"

require_relative "../lib/plugin_system/manifest"

# `ci-common.yml` runs `common/spec/` only, so the `args` specs cannot live in
# `common/lib/plugin_system/manifest_spec.rb` (lib specs never run in CI).
RSpec.describe "PluginSystem::Manifest with shape args" do
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

  def shape_with(args)
    {
      "label" => "Bounding Box",
      "icon" => "box.svg",
      **args
    }
  end

  it "keeps args on a shape, deep-symbolized" do
    manifest = manifest_with(
      [
        {
          "id" => "idah-video",
          "shapes" => {
            "bounding-box" => shape_with(
              "args" => {
                "frames" => { "type" => "array", "x-identity-key" => "frame" }
              }
            )
          }
        }
      ]
    )

    shape = manifest.modalities.first.shapes[:"bounding-box"]
    expect(shape.args).to eq({ frames: { type: "array", "x-identity-key": "frame" } })
  end

  it "keeps args on a tagging entry, deep-symbolized" do
    manifest = manifest_with(
      [
        {
          "id" => "idah-video",
          "tagging" => {
            "frame" => shape_with(
              "args" => {
                "frames" => { "type" => "array", "x-identity-key" => "frame" }
              }
            )
          }
        }
      ]
    )

    tagging = manifest.modalities.first.tagging[:frame]
    expect(tagging.args).to eq({ frames: { type: "array", "x-identity-key": "frame" } })
  end

  it "leaves args nil when a shape declares none" do
    manifest = manifest_with(
      [
        {
          "id" => "idah-image",
          "shapes" => { "mask" => shape_with({}) }
        }
      ]
    )

    expect(manifest.modalities.first.shapes[:mask].args).to be_nil
  end

  it "rejects a non-Hash args" do
    expect {
      manifest_with(
        [
          {
            "id" => "idah-video",
            "shapes" => { "bounding-box" => shape_with("args" => "nope") }
          }
        ]
      )
    }.to raise_error(Verse::Schema::InvalidSchemaError, /args.*must be a hash/)
  end

  it "still parses every manifest shipped in the repository" do
    Dir[File.expand_path("../../plugins/*/manifest.json", __dir__)].sort.each do |file|
      data = JSON.parse(File.read(file))
      result = PluginSystem::ManifestSchema.validate(data)
      expect(result.errors).to be_empty, "validation failed for #{file}: #{result.errors.inspect}"
    end
  end
end
