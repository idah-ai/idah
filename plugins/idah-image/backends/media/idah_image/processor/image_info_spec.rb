# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahImage::Processor::ImageInfo do
  let(:file_path) { "spec_data/sample.jpg" }
  let(:mock_image) do
    instance_double(
      Magick::Image,
      filename: "sample.jpg",
      columns: 1920,
      rows: 1080,
      format: "JPEG"
    )
  end

  before do
    allow(Magick::Image).to receive(:ping).with(file_path).and_return([mock_image])
  end

  describe ".from_file" do
    it "extracts image information correctly" do
      info = described_class.from_file(file_path)

      expect(info.filename).to eq("sample.jpg")
      expect(info.width).to eq(1920)
      expect(info.height).to eq(1080)
      expect(info.format).to eq("jpeg")
    end

    it "handles different formats by downcasing them" do
      allow(mock_image).to receive(:format).and_return("PNG")
      info = described_class.from_file(file_path)
      expect(info.format).to eq("png")
    end
  end
end
