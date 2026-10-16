# frozen_string_literal: true

require "spec_helper"
require "json"
require "tmpdir"
require "zlib"

RSpec.describe IdahImage::Export::Segmentation::Exporter do
  subject(:exporter) { described_class.new }

  let(:configuration) do
    {
      "idah-image:bounding-box": { values: [{ id: "car", color: "#009687" }] },
      "idah-image:polygon": { values: [{ id: "road" }] },
      "idah-image:line": { values: [{ id: "lane", color: "#F6402B" }] },
      "idah-image:mask": { values: [{ id: "water", color: "#00BBD6" }] }
    }
  end

  # 20 x 10 image: a normalized x of 0.1 is 2 px, a normalized y of 0.1 is 1 px.
  let(:meta) { { width: 20, height: 10 } }

  def shape(id, shape_type, shape_args, category: "car", **rest)
    FakeExportContext::Annotation.new(id:, shape_type:, category:, shape_args:, **rest)
  end

  def corners(x, y, w, h) = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

  # Pixels 2..5 x 1..3.
  let(:car) { shape("car-1", "idah-image:bounding-box", { points: corners(0.1, 0.1, 0.2, 0.3) }) }

  let(:annotations) { [car] }
  let(:entries) { [FakeExportContext::Entry.new(id: "entry-1", name: "street.jpg", annotations:, meta:)] }
  let(:datasets) { [FakeExportContext::Dataset.new(id: "ds-1", entries:, labeling_configuration: configuration)] }
  let(:options) { {} }
  let(:context) { FakeExportContext.new(datasets:, options:) }

  after { context.cleanup }

  def root = File.join(context.io.directory, "Dataset")

  def report
    JSON.parse(File.read(File.join(context.io.directory, "export_report.json")), symbolize_names: true)
  end

  def classes = JSON.parse(File.read(File.join(root, "classes.json")), symbolize_names: true)

  # The PNG's size, palette and pixel rows (class indexes as digits).
  def mask(stem = "street")
    bytes = File.binread(File.join(root, "masks", "#{stem}.png"))
    chunks = {}
    offset = 8
    while offset < bytes.bytesize
      length = bytes.byteslice(offset, 4).unpack1("N")
      chunks[bytes.byteslice(offset + 4, 4)] = bytes.byteslice(offset + 8, length)
      offset += 12 + length
    end
    width, height = chunks["IHDR"].unpack("NN")
    rows = Zlib::Inflate.inflate(chunks["IDAT"]).unpack("C*").each_slice(width + 1).map { |row| row.drop(1).join }
    { size: [width, height], palette: chunks["PLTE"].unpack("C*").each_slice(3).to_a, rows: }
  end

  describe "metadata" do
    it "describes the format, without options" do
      expect(exporter.name).to eq("Mask Segmentation (Image)")
      expect(exporter.options).to eq(Verse::Schema.empty)
    end
  end

  describe "#export" do
    it "writes a palette PNG per image, each pixel its class index" do
      exporter.export(context)

      png = mask
      expect(png[:size]).to eq([20, 10])
      expect(png[:rows].first(5)).to eq(
        %w[00000000000000000000 00111100000000000000 00111100000000000000 00111100000000000000 00000000000000000000]
      )
      expect(report).to include(datasets: 1, images: 1, annotations: 1)
    end

    it "lists the classes, lines last, with their configured colours, Pascal VOC's otherwise" do
      exporter.export(context)

      expect(classes).to eq(
        [
          { index: 0, name: "background", color: [0, 0, 0] },
          { index: 1, name: "car", color: [0, 150, 135] },
          { index: 2, name: "road", color: [0, 128, 0] },
          { index: 3, name: "water", color: [0, 187, 214] },
          { index: 4, name: "lane", color: [246, 64, 43] }
        ]
      )
      expect(mask[:palette]).to eq(classes.map { |klass| klass[:color] })
    end

    context "with every kind of shape" do
      let(:annotations) do
        [
          car,
          shape(
            "road-1",
            "idah-image:polygon",
            { points: [[0.5, 0.0], [0.7, 0.0], [0.7, 0.2], [0.5, 0.2]] },
            category: "road"
          ),
          # Through the centres of row 7.
          shape("lane-1", "idah-image:line", { points: [[0.025, 0.75], [0.975, 0.75]] }, category: "lane"),
          shape("water-1", "idah-image:mask", MaskTiles.shape_args([[18, 0], [19, 0]]), category: "water")
        ]
      end
      it "paints each with its class, a line 1 pixel wide" do
        exporter.export(context)

        rows = mask[:rows]
        expect(rows[0]).to eq("00000000002222000033")
        expect(rows[1]).to eq("00111100002222000000")
        expect(rows[7]).to eq("44444444444444444444")
        expect(report).to include(annotations: 4)
      end
    end

    context "with a circle" do
      let(:configuration) { { "idah-image:circle": { values: [{ id: "ball" }] } } }
      # Centre (10, 5), radius 0.4 of the shorter side: 4 px.
      let(:annotations) {
        [shape("ball-1", "idah-image:circle", { points: [[0.5, 0.5]], radius: 0.4 }, category: "ball")]
      }

      it "paints its outline, 1 pixel wide, and leaves the inside empty" do
        exporter.export(context)

        rows = mask[:rows]
        painted = rows.join.count("1")
        expect(rows[5][9..11]).to eq("000")
        expect(rows[5][5..7]).to include("1")
        expect(rows[5][13..15]).to include("1")
        # About its circumference, 2 pi x 4 = 25 pixels, against 50 filled.
        expect(painted).to be_between(20, 36)
      end
    end

    context "with an ellipse" do
      let(:configuration) { { "idah-image:ellipse": { values: [{ id: "plate" }] } } }
      # Centre (10, 5), radii 0.4 x 20 = 8 px and 0.3 x 10 = 3 px.
      let(:annotations) do
        [shape("plate-1", "idah-image:ellipse", { points: [[0.5, 0.5], [0.4, 0.3]] }, category: "plate")]
      end

      it "paints its outline too, and leaves the inside empty" do
        exporter.export(context)

        rows = mask[:rows]
        expect(rows[5][4..16]).to eq("0000000000000")
        expect(rows[5][1..3]).to include("1")
        expect(rows[2][9..11]).to include("1")
      end
    end

    context "with overlapping shapes" do
      let(:annotations) do
        [
          shape(
            "road-1",
            "idah-image:polygon",
            { points: corners(0.0, 0.0, 1.0, 1.0) },
            category: "road",
            created_at: "2026-10-02T00:00:00Z"
          ),
          shape(
            "car-1",
            "idah-image:bounding-box",
            { points: corners(0.1, 0.1, 0.2, 0.3) },
            created_at: "2026-10-01T00:00:00Z"
          )
        ]
      end

      it "paints them in creation order, the later on top" do
        exporter.export(context)

        expect(mask[:rows].uniq).to eq(["22222222222222222222"])
      end
    end

    context "with image-level tags" do
      let(:annotations) { [car, shape("root", "entry:root", {}, category: "rain")] }

      it "leaves them out, counted" do
        exporter.export(context)

        expect(report[:skipped]).to eq({ "unsupported_shape_type:entry:root": 1 })
      end
    end

    it "leaves out an image with no shape, and a dataset with none" do
      entries.replace([FakeExportContext::Entry.new(id: "entry-2", name: "empty.jpg", annotations: [], meta:)])

      exporter.export(context)

      expect(Dir.exist?(root)).to be(false)
      expect(report[:skipped]).to eq({ images_without_annotations: 1, datasets_without_annotations: 1 })
    end

    describe "image files" do
      let(:file) do
        path = File.join(Dir.tmpdir, "idah-mask-spec-#{Process.pid}.png")
        File.binwrite(path, "\x89PNG fake bytes")
        path
      end
      let(:entries) do
        [FakeExportContext::Entry.new(id: "entry-1", name: "street", annotations:, meta:, filename: "u.png", file:)]
      end
      let(:options) { { include_medias: "original" } }

      after { FileUtils.rm_f(file) }

      it "copies the original next to its mask" do
        exporter.export(context)

        expect(File.binread(File.join(root, "images", "street.png"))).to eq(File.binread(file))
        expect(File.exist?(File.join(root, "masks", "street.png"))).to be(true)
      end
    end
  end
end
