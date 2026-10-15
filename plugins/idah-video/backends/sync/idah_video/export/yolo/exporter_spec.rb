# frozen_string_literal: true

require "spec_helper"
require "json"
require "open3"
require "tmpdir"
require "yaml"

RSpec.describe IdahVideo::Export::Yolo::Exporter do
  subject(:exporter) { described_class.new }

  let(:configuration) do
    {
      "idah-video:bounding-box": { values: [{ id: "vehicles/car", label: "Car", parent: "vehicles" }] },
      "idah-video:polygon": { values: [{ id: "road", label: "Road" }] }
    }
  end

  # 1000x500 video: a normalized x of 0.1 is 100 px, a normalized y of 0.1 is 50 px.
  let(:meta) { { width: 1000, height: 500, fps: 25.0, duration: 4.0 } }

  def box(id, start:, finish:, frames:, category: "vehicles/car", **rest)
    FakeExportContext::Annotation.new(
      id:,
      shape_type: "idah-video:bounding-box",
      category:,
      shape_args: { start:, end: finish, frames: },
      **rest
    )
  end

  def keyframe(frame, x, y, w, h, angle: 0)
    { frame:, angle:, points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] }
  end

  let(:car) do
    box("car-1", start: 0, finish: 4, frames: [keyframe(0, 0.1, 0.1, 0.2, 0.2), keyframe(4, 0.5, 0.1, 0.2, 0.2)])
  end

  let(:annotations) { [car] }
  let(:entries) { [FakeExportContext::Entry.new(id: "entry-1", name: "street.mp4", annotations:, meta:)] }
  let(:datasets) { [FakeExportContext::Dataset.new(id: "ds-1", entries:, labeling_configuration: configuration)] }
  let(:options) { {} }
  let(:context) { FakeExportContext.new(datasets:, options:) }

  after { context.cleanup }

  def root(dataset = "Dataset") = File.join(context.io.directory, dataset)

  def data_yaml(dataset = "Dataset") = YAML.safe_load_file(File.join(root(dataset), "data.yaml"))

  def labels(frame, video: "street", dataset: "Dataset")
    File.read(File.join(root(dataset), "labels", "train", video, format("frame_%06d.txt", frame))).lines(chomp: true)
  end

  def label_files(dataset = "Dataset")
    Dir.glob("**/*.txt", base: File.join(root(dataset), "labels", "train")).sort
  end

  def report
    JSON.parse(File.read(File.join(context.io.directory, "export_report.json")), symbolize_names: true)
  end

  describe "metadata" do
    it "describes the format" do
      expect(exporter.name).to eq("YOLO Detect (Video)")
      expect(exporter.description).to be_a(String)
      expect(exporter.options).to eq(Verse::Schema.empty)
    end
  end

  describe "#export" do
    it "writes an Ultralytics dataset per IDAH dataset" do
      exporter.export(context)

      expect(Dir.children(context.io.directory).sort).to eq(%w[Dataset export_report.json])
      expect(Dir.children(root).sort).to eq(%w[data.yaml labels])
    end

    it "lists the dataset's categories as classes from 0, with every frame in train" do
      exporter.export(context)

      expect(data_yaml).to eq(
        "train" => "images/train",
        "val" => "images/train",
        "names" => { 0 => "vehicles/car", 1 => "road" }
      )
    end

    it "writes one label file per frame the shape covers, frames in between included" do
      exporter.export(context)

      expect(label_files).to eq((0..4).map { |f| format("street/frame_%06d.txt", f) })
      expect(report).to include(images: 5, annotations: 5, interpolated_annotations: 3)
    end

    it "writes each box as `class cx cy w h`, normalized to the frame" do
      exporter.export(context)

      expect(labels(0)).to eq(["0 0.200000 0.200000 0.200000 0.200000"])
      expect(labels(1)).to eq(["0 0.300000 0.200000 0.200000 0.200000"])
    end

    it "writes a rotated box as the box around it" do
      # 200 x 100 px box centred on (200, 100), turned a quarter: 100 x 200 px.
      car.record.shape_args[:frames] = [keyframe(0, 0.1, 0.1, 0.2, 0.2, angle: Math::PI / 2)]
      car.record.shape_args[:end] = 0

      exporter.export(context)

      expect(labels(0)).to eq(["0 0.200000 0.200000 0.100000 0.400000"])
    end

    it "clamps a box to the frame" do
      car.record.shape_args[:frames] = [keyframe(0, -0.1, 0.9, 0.2, 0.2)]
      car.record.shape_args[:end] = 0

      exporter.export(context)

      expect(labels(0)).to eq(["0 0.050000 0.950000 0.100000 0.100000"])
    end

    context "with a polygon and several shapes on a frame" do
      let(:annotations) do
        [
          car,
          FakeExportContext::Annotation.new(
            id: "road-1",
            shape_type: "idah-video:polygon",
            category: "road",
            shape_args: { start: 2, end: 2,
                          frames: [{ frame: 2, angle: 0, points: [[0.1, 0.2], [0.5, 0.2], [0.5, 1.2]] }] }
          )
        ]
      end

      it "writes the polygon as the box around it, one line per shape" do
        exporter.export(context)

        expect(labels(2)).to eq(["0 0.400000 0.200000 0.200000 0.200000", "1 0.300000 0.600000 0.400000 0.800000"])
      end
    end

    context "with entry-level and frame tags" do
      let(:annotations) do
        [
          car,
          FakeExportContext::Annotation.new(id: "root", shape_type: "entry:root", category: "rain", shape_args: {}),
          FakeExportContext::Annotation.new(
            id: "tag-1",
            shape_type: "idah-video:frame",
            category: "night",
            shape_args: { start: 7, end: 7, frames: [{ frame: 7, points: [] }] }
          )
        ]
      end

      it "leaves them out, since YOLO has boxes only, and counts them" do
        exporter.export(context)

        expect(label_files.size).to eq(5)
        expect(report[:skipped]).to eq(
          { "unsupported_shape_type:entry:root": 1, "unsupported_shape_type:idah-video:frame": 1 }
        )
      end
    end

    it "adds a category missing from the configuration as a class" do
      annotations << box(
        "dog-1",
        start: 0,
        finish: 0,
        frames: [keyframe(0, 0.1, 0.1, 0.1, 0.1)],
        category: "animals/dog"
      )

      exporter.export(context)

      expect(data_yaml["names"]).to eq({ 0 => "vehicles/car", 1 => "road", 2 => "animals/dog" })
      expect(labels(0).last).to start_with("2 ")
    end

    context "with several datasets" do
      before do
        datasets << FakeExportContext::Dataset.new(
          id: "ds-2",
          name: "Harbour",
          labeling_configuration: { "idah-video:bounding-box": { values: [{ id: "boats/ferry" }] } },
          entries: [FakeExportContext::Entry.new(
            id: "entry-2",
            name: "port.mp4",
            meta:,
            annotations: [box(
              "ferry-1",
              start: 0,
              finish: 0,
              category: "boats/ferry",
              frames: [keyframe(0, 0.1, 0.1, 0.2, 0.2)]
            )]
          )]
        )
      end

      it "writes each dataset with its own classes" do
        exporter.export(context)

        expect(data_yaml("Harbour")["names"]).to eq({ 0 => "boats/ferry" })
        expect(labels(0, video: "port", dataset: "Harbour")).to eq(["0 0.200000 0.200000 0.200000 0.200000"])
        expect(report).to include(datasets: 2, videos: 2)
      end

      it "leaves out a dataset without boxes, and reports it" do
        datasets.last.entries({}).first.annotations.first.record.data[:attributes][:deleted_at] = "2026-01-01"

        exporter.export(context)

        expect(Dir.exist?(root("Harbour"))).to be(false)
        expect(report[:skipped]).to include(datasets_without_annotated_frames: 1)
      end
    end

    describe "frame images" do
      # 10 frames at 10 fps.
      let(:video) do
        path = File.join(Dir.tmpdir, "idah-yolo-spec-#{Process.pid}.mp4")
        _, err, status = Open3.capture3(
          "ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=64x32:r=10:d=1", "-pix_fmt", "yuv420p", path
        )
        raise err unless status.success?

        path
      end

      let(:entries) do
        [FakeExportContext::Entry.new(id: "entry-1", name: "street.mp4", annotations:, meta:, video:)]
      end

      after { FileUtils.rm_f(video) }

      def image_files
        Dir.glob("**/*.jpg", base: File.join(root, "images", "train")).sort
      end

      context "with include_medias: original" do
        let(:options) { { include_medias: "original" } }

        it "writes an image beside each label file, as Ultralytics pairs them" do
          exporter.export(context)

          expect(image_files.map { |f| f.sub(".jpg", ".txt") }).to eq(label_files)
          expect(report[:image_files]).to eq(5)
        end
      end

      context "with include_medias: none" do
        let(:options) { { include_medias: "none" } }

        it "writes labels and data.yaml only" do
          exporter.export(context)

          expect(Dir.exist?(File.join(root, "images"))).to be(false)
        end
      end
    end

    it "refuses datasets of another modality" do
      datasets << FakeExportContext::Dataset.new(id: "ds-2", entries: [], modality: "idah-image")

      expect { exporter.export(context) }.to raise_error(ArgumentError, /idah-image/)
    end
  end
end
