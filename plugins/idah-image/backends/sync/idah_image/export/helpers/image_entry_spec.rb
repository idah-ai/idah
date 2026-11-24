# frozen_string_literal: true

require "spec_helper"
require "json"

RSpec.describe IdahImage::Export::Helpers::ImageEntry do
  describe "SYSTEM_SHAPES" do
    it "lists the system shapes declared in the plugin's manifest" do
      manifest = JSON.parse(File.read(File.expand_path("../../../../../manifest.json", __dir__)))
      declared = manifest["modalities"].flat_map do |modality|
        (modality["systemShapes"] || {}).keys.map { |name| "#{modality["id"]}:#{name}" }
      end

      expect(described_class::SYSTEM_SHAPES).to match_array(declared)
    end
  end
end
