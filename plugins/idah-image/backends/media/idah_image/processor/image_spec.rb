# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahImage::Processor::Image do
  let(:file_path) { "spec_data/sample.jpg" }
  let(:options) { {} }
  let(:processor_context) do
    FakeProcessorContext.new(
      file_path: file_path,
      resource: "fake_resource_id",
      options: options
    )
  end

  subject { described_class.new(processor_context) }

  let(:mock_image) { instance_double(Magick::Image, columns: 800, rows: 600, filename: "sample.jpg", format: "JPEG") }
  let(:mock_thumb) { instance_double(Magick::Image) }

  before do
    allow(processor_context).to receive(:download_original).and_return(file_path)
    allow(File).to receive(:exist?).and_call_original
    allow(File).to receive(:exist?).with(file_path).and_return(true)
    allow(File).to receive(:exist?).with(include("processed")).and_return(true)
    allow(File).to receive(:exist?).with(include("thumbnail")).and_return(true)

    allow(File).to receive(:delete).with(file_path)
    allow(File).to receive(:delete).with(include("processed"))
    allow(File).to receive(:delete).with(include("thumbnail"))

    # Mock RMagick ping for ImageInfo (if still used elsewhere, though not in processor anymore)
    allow(Magick::Image).to receive(:ping).with(file_path).and_return([mock_image])
    # Mock RMagick read for Image processor - should only be called once in run
    allow(Magick::Image).to receive(:read).with(file_path).once.and_return([mock_image])

    allow(mock_image).to receive(:write)
    allow(mock_image).to receive(:destroy!)
    allow(mock_image).to receive(:resize_to_fit).and_return(mock_thumb)

    allow(mock_thumb).to receive(:write)
    allow(mock_thumb).to receive(:destroy!)

    # Mock File.open for upload_media
    allow(File).to receive(:open).and_call_original
    allow(File).to receive(:open).with(include("processed"), "rb").and_yield(StringIO.new("processed data"))
    allow(File).to receive(:open).with(include("thumbnail"), "rb").and_yield(StringIO.new("thumbnail data"))
  end

  describe "#run" do
    it "processes the image and generates a thumbnail by default" do
      expect(processor_context).to receive(:upload_media).with(any_args, "processed.webp", "image/webp")
      expect(processor_context).to receive(:upload_media).with(any_args, "thumbnail.jpg", "image/jpeg")
      expect(processor_context).to receive(:update_original_metadata).with(hash_including(:width, :height, :format))

      # Cleanup verification
      expect(mock_image).to receive(:destroy!).once
      expect(mock_thumb).to receive(:destroy!).once
      expect(File).to receive(:delete).with(file_path).once
      expect(File).to receive(:delete).with(include("processed")).once
      expect(File).to receive(:delete).with(include("thumbnail")).once

      subject.run

      expect(processor_context.progress).to eq(1.0)
    end

    context "when generate_thumbnail is false" do
      let(:options) { { generate_thumbnail: false } }

      it "does not generate a thumbnail and cleans up" do
        allow(processor_context).to receive(:upload_media)
        allow(processor_context).to receive(:update_original_metadata)
        expect(processor_context).not_to receive(:upload_media).with(any_args, "thumbnail.jpg", "image/jpeg")

        expect(mock_image).to receive(:destroy!).once
        expect(mock_thumb).not_to receive(:destroy!)

        subject.run
      end
    end

    context "with custom processed_format" do
      let(:options) { { processed_format: "jpg" } }

      it "uploads with the correct format and mime type" do
        allow(processor_context).to receive(:upload_media)
        allow(processor_context).to receive(:update_original_metadata)
        expect(processor_context).to receive(:upload_media).with(any_args, "processed.jpg", "image/jpeg")
        subject.run
      end
    end

    context "when image dimensions exceed max_size" do
      let(:options) { { processed_max_size: 500 } }

      it "raises a ValidationFailed error and cleans up" do
        expect(File).to receive(:delete).with(file_path).once
        expect(Magick::Image).not_to receive(:read)
        expect(processor_context).not_to receive(:update_original_metadata)

        expect { subject.run }.to raise_error(Verse::Error::ValidationFailed, /Image width or height exceeded/)
      end
    end

    it "cleans up temporary files and objects even if an error occurs during processing" do
      allow(mock_image).to receive(:write).and_raise("Some error")
      allow(processor_context).to receive(:update_original_metadata)

      expect(mock_image).to receive(:destroy!).once
      expect(File).to receive(:delete).with(file_path).once
      expect(File).to receive(:delete).with(include("processed")).once

      expect { subject.run }.to raise_error("Some error")
    end
  end
end
