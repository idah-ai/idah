# frozen_string_literal: true

require "spec_helper"
require "json"
require "tmpdir"

RSpec.describe IdahImage::Export::Coco::Exporter do
  subject(:exporter) { described_class.new }

  let(:configuration) do
    {
      "idah-image:bounding-box": { values: [{ id: "vehicles/car", label: "Car", parent: "vehicles" }] },
      "idah-image:polygon": { values: [{ id: "road", label: "Road" }] },
      "idah-image:mask": { values: [{ id: "water", label: "Water" }] },
      "entry:root": { values: [{ id: "rain", label: "Rain" }] }
    }
  end

  # 1000x500 image: a normalized x of 0.1 is 100 px, a normalized y of 0.1 is 50 px.
  let(:meta) { { width: 1000, height: 500 } }

  def shape(id, shape_type, shape_args, category: "vehicles/car", **rest)
    FakeExportContext::Annotation.new(id:, shape_type:, category:, shape_args:, **rest)
  end

  def corners(x, y, w, h) = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

  let(:car) do
    shape("car-1", "idah-image:bounding-box", { points: corners(0.1, 0.1, 0.2, 0.2) }, properties: { color: "red" })
  end

  let(:annotations) { [car] }
  let(:entries) { [FakeExportContext::Entry.new(id: "entry-1", name: "street.jpg", annotations:, meta:)] }
  let(:datasets) { [FakeExportContext::Dataset.new(id: "ds-1", entries:, labeling_configuration: configuration)] }
  let(:options) { {} }
  let(:context) { FakeExportContext.new(datasets:, options:) }

  after { context.cleanup }

  def export
    exporter.export(context)
    path = File.join(context.io.directory, "annotations", "instances_Dataset.json")
    JSON.parse(File.read(path), symbolize_names: true)
  end

  def report
    JSON.parse(File.read(File.join(context.io.directory, "export_report.json")), symbolize_names: true)
  end

  describe "metadata" do
    it "describes the format, and how boxes are written as an option" do
      field = exporter.options.fields.first

      expect(exporter.name).to eq("COCO (Image)")
      expect(exporter.description).to be_a(String)
      expect(field.key).to eq(:boxes)
      expect(field.default).to eq("polygon")
      expect(field.opts[:meta][:choices].map { |choice| choice[:value] }).to eq(%w[polygon rectangle])
    end
  end

  describe "#export" do
    it "writes one COCO file per dataset with the standard keys" do
      coco = export

      expect(coco.keys).to eq(%i[info licenses categories images annotations])
      expect(coco[:categories].map { |c| c[:name] }).to eq(%w[vehicles/car road water])
    end

    it "writes one image per entry, named after it, with its IDAH ids" do
      expect(export[:images]).to eq(
        [{ id: 1, file_name: "street.jpg", width: 1000, height: 500, idah_entry_id: "entry-1",
           idah_dataset_id: "ds-1" }]
      )
    end

    it "writes a box as its outline polygon, with its bbox, area and attributes" do
      expect(export[:annotations].first).to eq(
        id: 1,
        image_id: 1,
        category_id: 1,
        iscrowd: 0,
        segmentation: [[100.0, 50.0, 300.0, 50.0, 300.0, 150.0, 100.0, 150.0]],
        bbox: [100.0, 50.0, 200.0, 100.0],
        area: 20_000.0,
        attributes: { color: "red", idah_id: "car-1", rotation: 0.0 }
      )
    end

    it "rotates a rotated box around its centre" do
      car.record.shape_args[:angle] = Math::PI / 2

      annotation = export[:annotations].first

      expect(annotation[:segmentation]).to eq([[250.0, 0.0, 250.0, 200.0, 150.0, 200.0, 150.0, 0.0]])
      expect(annotation[:bbox]).to eq([150.0, 0.0, 100.0, 200.0])
      expect(annotation[:attributes][:rotation]).to eq(90.0)
    end

    context "with boxes: rectangle" do
      let(:options) { { boxes: "rectangle" } }
      let(:turned) do
        shape("car-2", "idah-image:bounding-box", { points: corners(0.5, 0.1, 0.2, 0.2), angle: Math::PI / 2 })
      end
      let(:annotations) { [car, turned] }

      it "writes an upright box as its bbox only, and a rotated box with its corners" do
        upright, rotated = export[:annotations]

        expect(upright).to include(segmentation: [], bbox: [100.0, 50.0, 200.0, 100.0], area: 20_000.0)
        expect(rotated[:segmentation].first.size).to eq(8)
        expect(rotated[:attributes][:rotation]).to eq(90.0)
      end
    end

    context "with a circle and an ellipse" do
      let(:configuration) do
        {
          "idah-image:circle": { values: [{ id: "ball" }] },
          "idah-image:ellipse": { values: [{ id: "plate" }] }
        }
      end
      let(:annotations) do
        [
          # radius 0.1 of the shorter side (500 px): 50 px
          shape("ball-1", "idah-image:circle", { points: [[0.5, 0.5]], radius: 0.1 }, category: "ball"),
          # radii 0.1 of the width and 0.1 of the height: 100 x 50 px
          shape("plate-1", "idah-image:ellipse", { points: [[0.2, 0.2], [0.1, 0.1]] }, category: "plate")
        ]
      end

      it "writes them as polygons, with their exact box" do
        ball, plate = export[:annotations]

        expect(ball[:segmentation].first.size).to eq(128)
        expect(ball[:bbox]).to eq([450.0, 200.0, 100.0, 100.0])
        expect(ball[:area]).to be_within(20).of(Math::PI * 50 * 50)
        expect(ball[:attributes]).not_to have_key(:rotation)
        expect(plate[:bbox]).to eq([100.0, 50.0, 200.0, 100.0])
        expect(plate[:attributes]).to include(rotation: 0.0)
      end
    end

    context "with a mask" do
      let(:pixels) { (10...30).to_a.product((20...25).to_a) + [[200, 100]] }
      let(:annotations) { [shape("water-1", "idah-image:mask", MaskTiles.shape_args(pixels), category: "water")] }
      let(:meta) { { width: 300, height: 200 } }

      it "writes it as COCO RLE, with its pixel area and box" do
        annotation = export[:annotations].first

        expect(annotation[:segmentation][:size]).to eq([200, 300])
        # Column by column: 10 empty columns and 20 rows, then 5 set pixels in
        # each of columns 10 to 29, then the lone pixel at (200, 100).
        runs = [2020, 5] + ([195, 5] * 19) + [34_275, 1, 19_899]
        expect(runs.sum).to eq(300 * 200)
        expect(annotation[:segmentation][:counts]).to eq(IdahImage::Export::Helpers::Mask.compress(runs))
        expect(annotation[:area]).to eq(101)
        expect(annotation[:bbox]).to eq([10, 20, 191, 81])
        expect(annotation[:category_id]).to eq(3)
      end
    end

    context "with image-level tags and lines" do
      let(:annotations) do
        [
          car,
          shape("root", "entry:root", {}, category: "rain", properties: { visibility: "low" }),
          shape("line-1", "idah-image:line", { points: [[0.1, 0.1], [0.2, 0.2]] }, category: "road")
        ]
      end

      it "keeps the tags on the image and leaves lines out, counted" do
        coco = export

        expect(coco[:images].first[:attributes]).to eq({ category: "rain", visibility: "low" })
        expect(coco[:annotations].size).to eq(1)
        expect(report[:skipped]).to eq({ "unsupported_shape_type:idah-image:line": 1 })
      end
    end

    describe "skipped data" do
      let(:annotations) do
        [
          car,
          shape(
            "deleted",
            "idah-image:bounding-box",
            { points: corners(0.1, 0.1, 0.1, 0.1) },
            deleted_at: "2026-01-01"
          ),
          shape("no-category", "idah-image:bounding-box", { points: corners(0.1, 0.1, 0.1, 0.1) }, category: nil),
          shape("outside", "idah-image:bounding-box", { points: corners(1.1, 0.1, 0.1, 0.1) }),
          shape("two-points", "idah-image:polygon", { points: [[0.1, 0.1], [0.2, 0.2]] }, category: "road"),
          shape("empty-mask", "idah-image:mask", {}, category: "water")
        ]
      end

      it "leaves them out and counts them in export_report.json" do
        expect(export[:annotations].size).to eq(1)
        expect(report).to include(
          datasets: 1,
          images: 1,
          annotations: 1,
          skipped: { deleted: 1, no_category: 1, zero_area: 2, too_few_points: 1 }
        )
      end
    end

    it "leaves out an entry with nothing to export, and reports it" do
      entries << FakeExportContext::Entry.new(id: "entry-2", name: "empty.jpg", annotations: [], meta:)

      expect(export[:images].size).to eq(1)
      expect(report[:skipped]).to eq({ images_without_annotations: 1 })
    end

    it "skips an entry whose size is unknown, and reports it" do
      entries << FakeExportContext::Entry.new(id: "entry-2", name: "broken.jpg", annotations: [car], meta: nil)

      export

      expect(report[:warnings]).to eq(["Entry `broken.jpg` (entry-2) skipped: image width and height are unknown."])
    end

    describe "image files" do
      let(:file) do
        path = File.join(Dir.tmpdir, "idah-coco-image-spec-#{Process.pid}.png")
        File.binwrite(path, "\x89PNG fake bytes")
        path
      end
      let(:entries) do
        [FakeExportContext::Entry.new(id: "entry-1", name: "street", annotations:, meta:, filename: "u.png", file:)]
      end

      after { FileUtils.rm_f(file) }

      context "with include_medias: original" do
        let(:options) { { include_medias: "original" } }

        it "copies the original file unchanged, keeping its extension" do
          coco = export

          path = File.join(context.io.directory, "images", "Dataset", coco[:images].first[:file_name])
          expect(coco[:images].first[:file_name]).to eq("street.png")
          expect(File.binread(path)).to eq(File.binread(file))
          expect(report[:image_files]).to eq(1)
        end
      end

      context "with include_medias: none" do
        let(:options) { { include_medias: "none" } }

        it "writes labels only" do
          export

          expect(Dir.exist?(File.join(context.io.directory, "images"))).to be(false)
        end
      end

      context "when the original cannot be read" do
        let(:options) { { include_medias: "original" } }

        it "keeps the labels and reports it" do
          FileUtils.rm_f(file)

          expect(export[:annotations].size).to eq(1)
          expect(report[:warnings]).to eq(
            ["Entry `street` (entry-1): no image, the original could not be read (Errno::ENOENT)."]
          )
        end
      end
    end

    it "refuses datasets of another modality" do
      datasets << FakeExportContext::Dataset.new(id: "ds-2", entries: [], modality: "idah-video")

      expect { exporter.export(context) }.to raise_error(ArgumentError, /idah-video/)
    end
  end
end
