# frozen_string_literal: true

require "spec_helper"
require "tmpdir"
require "fileutils"

RSpec.describe IdahVideo::Processor::Ffmpeg do
  let(:sample_path) { "spec_data/sample.mp4" }

  describe ".gen_stream" do
    it "generates a 240p video variant" do
      Dir.mktmpdir do |tmpdir|
        variant = IdahVideo::Processor::Ffmpeg::StreamVariant.new(
          name: "240p",
          width: 426,
          height: 240,
          bitrate: "500k",
          audiobitrate: "64k"
        )

        described_class.gen_stream(
          dir: tmpdir,
          file: File.expand_path(sample_path),
          variants: [variant]
        )

        # Check if the m3u8 and ts files were created
        m3u8_file = File.join(tmpdir, "240p.m3u8")
        ts_files = Dir.glob(File.join(tmpdir, "240p_*.ts"))

        expect(File.exist?(m3u8_file)).to be(true)
        expect(ts_files).not_to be_empty

        # Verify the resolution of a generated segment
        video_info = IdahVideo::Processor::VideoInfo.from_file(ts_files.first)
        expect(video_info.height).to eq(240)
      end
    end

    context "with an invalid input file" do
      let(:invalid_file) { "spec_data/repository_helper.rb" }

      it "raises an error" do
        Dir.mktmpdir do |tmpdir|
          variant = IdahVideo::Processor::Ffmpeg::StreamVariant.new(
            name: "240p",
            width: 426,
            height: 240,
            bitrate: "500k",
            audiobitrate: "64k"
          )

          expect do
            described_class.gen_stream(
              dir: tmpdir,
              file: File.expand_path(invalid_file),
              variants: [variant]
            )
          end.to raise_error(/Failed to execute `ffmpeg/)
        end
      end
    end
  end
end
