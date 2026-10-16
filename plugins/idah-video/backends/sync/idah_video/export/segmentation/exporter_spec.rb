# frozen_string_literal: true

require "spec_helper"
require "json"
require "open3"
require "tmpdir"
require "zlib"

RSpec.describe IdahVideo::Export::Segmentation::Exporter do
  subject(:exporter) { described_class.new }

  let(:configuration) do
    {
      "idah-video:bounding-box": { values: [{ id: "car", color: "#009687" }] },
      "idah-video:polygon": { values: [{ id: "road" }] }
    }
  end

  # 20 x 10 video: a normalized x of 0.1 is 2 px, a normalized y of 0.1 is 1 px.
  let(:meta) { { width: 20, height: 10, fps: 10.0, duration: 1.0 } }

  def box(id, start:, finish:, frames:, category: "car", **rest)
    FakeExportContext::Annotation.new(
      id:, shape_type: "idah-video:bounding-box", category:, shape_args: { start:, end: finish, frames: }, **rest
    )
  end

  def keyframe(frame, x, y, w, h) = { frame:, angle: 0, points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] }

  # Pixels 2..5 x 1..3 on frame 0, moving right to 10..13 on frame 4.
  let(:car) do
    box("car-1", start: 0, finish: 4, frames: [keyframe(0, 0.1, 0.1, 0.2, 0.3), keyframe(4, 0.5, 0.1, 0.2, 0.3)])
  end

  let(:annotations) { [car] }
  let(:entries) { [FakeExportContext::Entry.new(id: "entry-1", name: "street.mp4", annotations:, meta:)] }
  let(:datasets) { [FakeExportContext::Dataset.new(id: "ds-1", entries:, labeling_configuration: configuration)] }
  let(:options) { {} }
  let(:context) { FakeExportContext.new(datasets:, options:) }

  after { context.cleanup }

  def root = File.join(context.io.directory, "Dataset")

  def report
    JSON.parse(File.read(File.join(context.io.directory, "export_report.json")), symbolize_names: true)
  end

  def mask_files = Dir.glob("**/*.png", base: File.join(root, "masks")).sort

  # The PNG's pixel rows, class indexes as digits.
  def mask_rows(frame, video: "street")
    bytes = File.binread(File.join(root, "masks", video, format("frame_%06d.png", frame)))
    chunks = {}
    offset = 8
    while offset < bytes.bytesize
      length = bytes.byteslice(offset, 4).unpack1("N")
      chunks[bytes.byteslice(offset + 4, 4)] = bytes.byteslice(offset + 8, length)
      offset += 12 + length
    end
    width = chunks["IHDR"].unpack1("N")
    Zlib::Inflate.inflate(chunks["IDAT"]).unpack("C*").each_slice(width + 1).map { |row| row.drop(1).join }
  end

  describe "metadata" do
    it "describes the format and its frames option" do
      expect(exporter.name).to eq("Mask Segmentation (Video)")
      expect(exporter.options.validate({}).value).to eq(frames: "all")
    end
  end

  describe "#export" do
    it "writes a mask per frame the shape covers, interpolated between keyframes" do
      exporter.export(context)

      expect(mask_files).to eq((0..4).map { |frame| format("street/frame_%06d.png", frame) })
      expect(mask_rows(0)[1]).to eq("00111100000000000000")
      expect(mask_rows(2)[1]).to eq("00000011110000000000")
      expect(mask_rows(4)[1]).to eq("00000000001111000000")
      expect(report).to include(datasets: 1, videos: 1, images: 5, annotations: 5, interpolated_annotations: 3)
    end

    it "lists the classes with their configured colours, Pascal VOC's otherwise" do
      exporter.export(context)

      expect(JSON.parse(File.read(File.join(root, "classes.json")), symbolize_names: true)).to eq(
        [
          { index: 0, name: "background", color: [0, 0, 0] },
          { index: 1, name: "car", color: [0, 150, 135] },
          { index: 2, name: "road", color: [0, 128, 0] }
        ]
      )
    end

    context "with frames: keyframes" do
      let(:options) { { frames: "keyframes" } }

      it "writes the frames with a stored keyframe only" do
        exporter.export(context)

        expect(mask_files).to eq(%w[street/frame_000000.png street/frame_000004.png])
      end
    end

    context "with overlapping shapes" do
      let(:annotations) do
        [
          FakeExportContext::Annotation.new(
            id: "road-1",
            shape_type: "idah-video:polygon",
            category: "road",
            shape_args: { start: 0, end: 0, frames: [{ frame: 0, points: [[0, 0], [1, 0], [1, 1], [0, 1]] }] },
            created_at: "2026-10-02T00:00:00Z"
          ),
          box(
            "car-1",
            start: 0,
            finish: 0,
            frames: [keyframe(0, 0.1, 0.1, 0.2, 0.3)],
            created_at: "2026-10-01T00:00:00Z"
          )
        ]
      end

      it "paints them in creation order, the later on top" do
        exporter.export(context)

        expect(mask_rows(0).uniq).to eq(["22222222222222222222"])
      end
    end

    context "with frame and entry tags" do
      let(:annotations) do
        [
          car,
          FakeExportContext::Annotation.new(
            id: "tag",
            shape_type: "idah-video:frame",
            category: "night",
            shape_args: { start: 2, end: 2, frames: [{ frame: 2, points: [] }] }
          ),
          FakeExportContext::Annotation.new(id: "root", shape_type: "entry:root", category: "rain", shape_args: {})
        ]
      end

      it "leaves them out, counted" do
        exporter.export(context)

        expect(report[:skipped]).to include(
          "unsupported_shape_type:idah-video:frame": 1, "unsupported_shape_type:entry:root": 1
        )
      end
    end

    it "leaves out a video with no shape, and a dataset with none" do
      entries.replace([FakeExportContext::Entry.new(id: "entry-2", name: "empty.mp4", annotations: [], meta:)])

      exporter.export(context)

      expect(Dir.exist?(root)).to be(false)
      expect(report[:skipped]).to eq({ videos_without_annotated_frames: 1, datasets_without_annotated_frames: 1 })
    end

    describe "frame images" do
      # 10 frames at 10 fps.
      let(:video) do
        path = File.join(Dir.tmpdir, "idah-mask-spec-#{Process.pid}.mp4")
        _, err, status = Open3.capture3(
          "ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=20x10:r=10:d=1", "-pix_fmt", "yuv420p", path
        )
        raise err unless status.success?

        path
      end
      let(:entries) do
        [FakeExportContext::Entry.new(id: "entry-1", name: "street.mp4", annotations:, meta:, video:)]
      end
      let(:options) { { include_medias: "original" } }

      after { FileUtils.rm_f(video) }

      it "writes a frame image beside each mask" do
        exporter.export(context)

        images = Dir.glob("**/*.jpg", base: File.join(root, "images")).sort
        expect(images.map { |file| file.sub(".jpg", ".png") }).to eq(mask_files)
        expect(report[:image_files]).to eq(5)
      end
    end
  end
end
