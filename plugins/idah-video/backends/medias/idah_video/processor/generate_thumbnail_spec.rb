# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::Processor::GenerateThumbnail do
  let(:file_path) {
    "spec_data/sample.mp4"
  }

  describe ".generate" do
    it "runs without errors" do
      video_info = IdahVideo::Processor::VideoInfo.from_file(file_path)
      described_class.call(file_path, video_info) do |output|
        expect(output).to be_a(String)

        # Open the file and
        # Ensure the output is 240 x 10 width:
        image = Magick::Image.read(output).first
        expect(image.columns).to eq(2400)
        image.destroy! if image.respond_to?(:destroy!)
      end
    end
  end
end
