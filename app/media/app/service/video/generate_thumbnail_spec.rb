# frozen_string_literal: true

require "spec_helper"

RSpec.describe Video::GenerateThumbnail do
  let(:file_path) {
    "spec_data/sample.mp4"
  }

  describe ".generate" do
    it "runs without errors" do
      begin
        video_info = Video::VideoInfo.from_file(file_path)
        output = described_class.(file_path, video_info)

        expect(output).to be_a(String)

        # Open the file and
        # Ensure the output is 240 x 10 width:
        image = Magick::Image.read(output).first
        expect(image.columns).to eq(2400)
      ensure
        # Clean up the generated files
        FileUtils.rm_rf(File.dirname(output)) if output && File.exist?(output)
        image.destroy! if image && image.respond_to?(:destroy!)
      end
    end
  end
end
