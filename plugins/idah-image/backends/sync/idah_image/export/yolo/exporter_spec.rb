# frozen_string_literal: true

require "spec_helper"
require "tmpdir"
require "yaml"
require "zlib"

RSpec.describe IdahImage::Export::Yolo::Exporter do
  subject(:exporter) { described_class.new }

  let(:configuration) do
    {
      "idah-image:bounding-box": { values: [{ id: "car", label: "Car" }] },
      "idah-image:polygon": { values: [{ id: "road", label: "Road" }] },
      "idah-image:mask": { values: [{ id: "water", label: "Water" }] }
    }
  end

  # 1000x500 image: a normalized x of 0.1 is 100 px, a normalized y of 0.1 is 50 px.
  let(:meta) { { width: 1000, height: 500 } }

  def shape(id, shape_type, shape_args, category: "car", **rest)
    FakeExportContext::Annotation.new(id:, shape_type:, category:, shape_args:, **rest)
  end

  def corners(x, y, w, h) = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

  let(:car) { shape("car-1", "idah-image:bounding-box", { points: corners(0.1, 0.1, 0.2, 0.2) }) }
  # A triangle: its smallest rotated rectangle is not its upright box.
  let(:road) do
    shape("road-1", "idah-image:polygon", { points: [[0.5, 0.1], [0.7, 0.5], [0.3, 0.5]] }, category: "road")
  end

  let(:annotations) { [car, road] }
  let(:entries) { [FakeExportContext::Entry.new(id: "entry-1", name: "street.jpg", annotations:, meta:)] }
  let(:datasets) { [FakeExportContext::Dataset.new(id: "ds-1", entries:, labeling_configuration: configuration)] }
  let(:options) { {} }
  let(:context) { FakeExportContext.new(datasets:, options:) }

  after { context.cleanup }

  def root = File.join(context.io.directory, "Dataset")

  def labels(split = "train", stem = "street")
    File.read(File.join(root, "labels", split, "#{stem}.txt")).lines.map { |line| line.split.map(&:to_f) }
  end

  def report
    JSON.parse(File.read(File.join(context.io.directory, "export_report.json")), symbolize_names: true)
  end

  describe "metadata" do
    it "describes the format and its options" do
      expect(exporter.name).to eq("YOLO (Image)")
      expect(exporter.options.validate({}).value).to eq(task: "detect", val_percent: 0)
    end
  end

  describe "#export" do
    it "writes data.yaml with the dataset's classes, counted from 0" do
      exporter.export(context)

      expect(YAML.load_file(File.join(root, "data.yaml"))).to eq(
        "train" => "images/train", "val" => "images/train", "names" => { 0 => "car", 1 => "road", 2 => "water" }
      )
    end

    it "writes one label file per image, a box line per shape" do
      exporter.export(context)

      expect(labels).to eq([[0, 0.2, 0.2, 0.2, 0.2], [1, 0.5, 0.3, 0.4, 0.4]])
      expect(report).to include(datasets: 1, images: 1, annotations: 2)
    end

    context "with task: segment" do
      let(:options) { { task: "segment" } }

      it "writes the outlines" do
        exporter.export(context)

        expect(labels).to eq([[0, 0.1, 0.1, 0.3, 0.1, 0.3, 0.3, 0.1, 0.3], [1, 0.5, 0.1, 0.7, 0.5, 0.3, 0.5]])
      end
    end

    context "with task: obb" do
      let(:options) { { task: "obb" } }

      it "writes a box's own corners, and the rotated rectangle around a polygon" do
        car.record.shape_args[:angle] = Math::PI / 2

        exporter.export(context)

        box, triangle = labels
        expect(box.drop(1).each_slice(2).map { |x, y| [(x * 1000).round, (y * 500).round] })
          .to contain_exactly([150, 0], [250, 0], [250, 200], [150, 200])
        expect(triangle.size).to eq(9)
      end
    end

    context "with a mask in two pieces" do
      let(:meta) { { width: 300, height: 200 } }
      let(:pixels) { (10...30).to_a.product((20...30).to_a) + (100...110).to_a.product((100...150).to_a) }
      let(:annotations) { [shape("water-1", "idah-image:mask", MaskTiles.shape_args(pixels), category: "water")] }

      it "writes a line per piece" do
        exporter.export(context)

        expect(labels.map { |line| line.map { |v| v.round(4) } }).to contain_exactly(
          [2, 0.0667, 0.125, 0.0667, 0.05], [2, 0.35, 0.625, 0.0333, 0.25]
        )
        expect(report).to include(images: 1, annotations: 2)
      end
    end

    context "with a mask with specks" do
      let(:meta) { { width: 300, height: 200 } }
      # A 10 x 10 piece, and specks of 4 and 16 pixels.
      def square(x, y, size) = (x...(x + size)).to_a.product((y...(y + size)).to_a)

      let(:pixels) { square(10, 10, 10) + square(50, 50, 2) + square(100, 100, 4) }
      let(:annotations) { [shape("water-1", "idah-image:mask", MaskTiles.shape_args(pixels), category: "water")] }

      it "leaves out pieces under 20 pixels, counted" do
        exporter.export(context)

        expect(labels.size).to eq(1)
        expect(report[:skipped]).to eq({ small_mask_pieces: 2 })
      end
    end

    context "with a mask whose outline is very long" do
      let(:options) { { task: "segment" } }
      let(:meta) { { width: 300, height: 200 } }
      # A comb: 30 teeth of 1 x 100 pixels, 2 pixels apart, on a 1-pixel spine;
      # its outline keeps about 60 points.
      let(:pixels) { (0...30).flat_map { |i| [i * 2].product((10...110).to_a) } + (0...59).to_a.product([110]) }
      let(:annotations) { [shape("water-1", "idah-image:mask", MaskTiles.shape_args(pixels), category: "water")] }

      before { stub_const("#{described_class}::LONG_OUTLINE", 10) }

      it "exports it and warns" do
        exporter.export(context)

        expect(labels.size).to eq(1)
        expect(report[:warnings]).to match(
          [/\AEntry `street.jpg` \(entry-1\): a `water` mask outline has \d+ points; .* Use the COCO export/]
        )
      end
    end

    context "with a mask with a hole" do
      let(:meta) { { width: 300, height: 200 } }
      let(:ring) { (10...30).to_a.product((20...40).to_a) - (15...25).to_a.product((25...35).to_a) }
      let(:annotations) { [shape("water-1", "idah-image:mask", MaskTiles.shape_args(ring), category: "water")] }

      context "with task: segment" do
        let(:options) { { task: "segment" } }

        it "keeps the hole, joined to the outline by a cut" do
          exporter.export(context)

          line = labels.first
          points = line.drop(1).each_slice(2).map { |x, y| [(x * 300).round, (y * 200).round] }
          expect(labels.size).to eq(1)
          outer = [[10, 20], [30, 20], [30, 40], [10, 40]]
          hole = [[15, 25], [25, 25], [25, 35], [15, 35]]
          expect(points.uniq).to match_array(outer + hole)
        end
      end

      it "writes the piece's box for detect" do
        exporter.export(context)

        expect(labels.map { |line| line.map { |v| v.round(4) } }).to eq([[2, 0.0667, 0.15, 0.0667, 0.1]])
      end
    end

    context "with image-level tags and lines" do
      let(:annotations) do
        [
          car,
          shape("root", "entry:root", {}, category: "rain"),
          shape("line-1", "idah-image:line", { points: [[0.1, 0.1], [0.2, 0.2]] }, category: "road")
        ]
      end

      it "leaves them out, counted" do
        exporter.export(context)

        expect(labels.size).to eq(1)
        expect(report[:skipped]).to eq(
          { "unsupported_shape_type:entry:root": 1, "unsupported_shape_type:idah-image:line": 1 }
        )
      end
    end

    it "leaves out an image with no shape, and a dataset with none" do
      entries.replace([FakeExportContext::Entry.new(id: "entry-2", name: "empty.jpg", annotations: [], meta:)])

      exporter.export(context)

      expect(Dir.exist?(root)).to be(false)
      expect(report[:skipped]).to eq({ images_without_annotations: 1, datasets_without_annotations: 1 })
    end

    describe "val_percent" do
      let(:ids) { (1..40).map { |i| "entry-#{i}" } }
      let(:entries) do
        ids.map { |id| FakeExportContext::Entry.new(id:, name: "#{id}.jpg", annotations: [car], meta:) }
      end
      let(:options) { { val_percent: 25 } }

      it "puts the images chosen by their id in val" do
        exporter.export(context)

        val = ids.select { |id| Zlib.crc32(id) % 100 < 25 }
        expect(Dir.children(File.join(root, "labels", "val")).sort).to eq(val.map { |id| "#{id}.txt" }.sort)
        expect(Dir.children(File.join(root, "labels", "train")).size).to eq(40 - val.size)
        expect(YAML.load_file(File.join(root, "data.yaml"))["val"]).to eq("images/val")
      end
    end

    it "warns when no image falls in val" do
      context.options[:val_percent] = 1 if Zlib.crc32("entry-1") % 100 >= 1

      exporter.export(context)

      expect(report[:warnings]).to eq(["Dataset `Dataset` (ds-1): no image fell in val; val points at train."])
    end

    describe "image files" do
      let(:file) do
        path = File.join(Dir.tmpdir, "idah-yolo-image-spec-#{Process.pid}.png")
        File.binwrite(path, "\x89PNG fake bytes")
        path
      end
      let(:entries) do
        [FakeExportContext::Entry.new(id: "entry-1", name: "street", annotations:, meta:, filename: "u.png", file:)]
      end
      let(:options) { { include_medias: "original" } }

      after { FileUtils.rm_f(file) }

      it "copies the original next to its labels' path" do
        exporter.export(context)

        expect(File.binread(File.join(root, "images", "train", "street.png"))).to eq(File.binread(file))
        expect(File.exist?(File.join(root, "labels", "train", "street.txt"))).to be(true)
      end
    end
  end
end
