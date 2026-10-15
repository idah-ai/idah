# frozen_string_literal: true

require "spec_helper"
require "open3"
require "tmpdir"

RSpec.describe IdahVideo::Export::Helpers::FrameExtractor do
  let(:dir) { Dir.mktmpdir }
  let(:output_dir) { File.join(dir, "images", "street") }

  # 30 frames at 10 fps, where frame n is a flat grey of brightness n * 8, so
  # an extracted image tells which frame it came from.
  let(:video) do
    path = File.join(dir, "numbered.mp4")
    _, err, status = Open3.capture3(
      "ffmpeg",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "nullsrc=s=32x32:r=10:d=3,geq=lum='N*8':cb=128:cr=128",
      "-c:v",
      "libx264",
      "-qp",
      "0",
      "-pix_fmt",
      "yuv420p",
      path
    )
    raise err unless status.success?

    path
  end

  after { FileUtils.rm_rf(dir) }

  # Mean brightness of an image, decoded with ffmpeg.
  def brightness(path)
    out, _, status = Open3.capture3("ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "gray", "-")
    raise "cannot decode #{path}" unless status.success?

    out.bytes.sum / out.bytesize.to_f
  end

  describe ".extract" do
    it "writes the requested frames, named by frame number" do
      written = described_class.extract(video, [0, 3, 4, 5, 17, 29], output_dir)

      expect(written).to eq([0, 3, 4, 5, 17, 29])
      expect(Dir.children(output_dir).sort).to eq(
        %w[frame_000000.jpg frame_000003.jpg frame_000004.jpg frame_000005.jpg frame_000017.jpg frame_000029.jpg]
      )
    end

    it "takes each image from its own frame of the video" do
      described_class.extract(video, [3, 17, 29], output_dir)

      [3, 17, 29].each do |frame|
        # The video stores brightness on the 16-235 video scale, JPEG on 0-255.
        expected = (frame * 8 - 16) * 255 / 219.0

        expect(brightness(File.join(output_dir, format("frame_%06d.jpg", frame)))).to be_within(3).of(expected)
      end
    end

    it "returns only the frames the video has" do
      expect(described_class.extract(video, [28, 29, 30, 31], output_dir)).to eq([28, 29])
      expect(Dir.children(output_dir).sort).to eq(%w[frame_000028.jpg frame_000029.jpg])
    end

    it "does nothing without frames" do
      expect(described_class.extract(video, [], output_dir)).to eq([])
      expect(Dir.exist?(output_dir)).to be(false)
    end

    it "raises when ffmpeg cannot read the video" do
      broken = File.join(dir, "broken.mp4")
      File.write(broken, "not a video")

      expect { described_class.extract(broken, [0], output_dir) }.to raise_error(/ffmpeg/)
    end
  end

  describe ".ranges" do
    it "groups consecutive frames into ranges" do
      expect(described_class.ranges([0, 1, 2, 5, 7, 8])).to eq([0..2, 5..5, 7..8])
    end
  end
end
