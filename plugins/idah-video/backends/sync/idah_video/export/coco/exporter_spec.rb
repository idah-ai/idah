# frozen_string_literal: true

require "spec_helper"
require "json"
require "open3"
require "tmpdir"

RSpec.describe IdahVideo::Export::Coco::Exporter do
  subject(:exporter) { described_class.new }

  let(:configuration) do
    {
      "idah-video:bounding-box": { values: [{ id: "vehicles/car", label: "Car", parent: "vehicles" }] },
      "idah-video:polygon": { values: [{ id: "road", label: "Road" }] },
      "idah-video:frame": { values: [{ id: "night", label: "Night" }] },
      "entry:root": { values: [{ id: "rain", label: "Rain" }] }
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
    box(
      "car-1",
      start: 0,
      finish: 4,
      frames: [keyframe(0, 0.1, 0.1, 0.2, 0.2), keyframe(4, 0.5, 0.1, 0.2, 0.2)],
      properties: { color: "red" }
    )
  end

  let(:annotations) { [car] }
  let(:entries) { [FakeExportContext::Entry.new(id: "entry-1", name: "street.mp4", annotations:, meta:)] }
  let(:datasets) { [FakeExportContext::Dataset.new(id: "ds-1", entries:, labeling_configuration: configuration)] }
  let(:options) { {} }
  let(:context) { FakeExportContext.new(datasets:, options:) }

  after { context.cleanup }

  def export
    exporter.export(context)
    coco_file("Dataset")
  end

  # A dataset's COCO file, by its file name.
  def coco_file(dataset)
    path = File.join(context.io.directory, "annotations", "instances_#{dataset}.json")
    JSON.parse(File.read(path), symbolize_names: true)
  end

  def annotation_files
    dir = File.join(context.io.directory, "annotations")
    Dir.exist?(dir) ? Dir.children(dir).sort : []
  end

  def report
    JSON.parse(File.read(File.join(context.io.directory, "export_report.json")), symbolize_names: true)
  end

  # Frame numbers of the exported images, by image id.
  def frame_of(coco)
    coco[:images].to_h { |i| [i[:id], i[:file_name][/frame_(\d+)/, 1].to_i] }
  end

  describe "metadata" do
    it "describes the format" do
      expect(exporter.name).to eq("COCO (Video)")
      expect(exporter.description).to be_a(String)
      expect(exporter.options).to eq(Verse::Schema.empty)
    end
  end

  describe "#export" do
    it "writes one COCO file with the standard keys, plus the videos list" do
      coco = export

      expect(coco.keys).to eq(%i[info licenses categories videos images annotations])
      expect(coco[:categories]).to eq(
        [{ id: 1, name: "vehicles/car", supercategory: "vehicles" }, { id: 2, name: "road", supercategory: "" }]
      )
    end

    it "writes one image per frame the shape covers, with interpolated frames in between" do
      coco = export

      expect(coco[:images]).to eq(
        (0..4).map do |f|
          { id: f + 1, file_name: format("street/frame_%06d.jpg", f), width: 1000, height: 500, video_id: 1,
            frame_id: f }
        end
      )
      expect(report).to include(annotations: 5, interpolated_annotations: 3)
    end

    it "writes a box as its outline polygon, with its bbox and area in pixels" do
      first, second = export[:annotations]

      expect(first).to eq(
        id: 1,
        image_id: 1,
        category_id: 1,
        iscrowd: 0,
        segmentation: [[100.0, 50.0, 300.0, 50.0, 300.0, 150.0, 100.0, 150.0]],
        bbox: [100.0, 50.0, 200.0, 100.0],
        area: 20_000.0,
        track_id: 1,
        attributes: { color: "red", idah_id: "car-1", keyframe: true, rotation: 0.0 }
      )
      expect(second[:bbox]).to eq([200.0, 50.0, 200.0, 100.0])
    end

    it "lists no split groups when every group has one category" do
      export

      expect(report[:split_groups]).to eq([])
    end

    context "with several datasets" do
      let(:harbour_configuration) do
        { "idah-video:bounding-box": { values: [{ id: "boats/ferry", label: "Ferry" }, { id: "vehicles/car" }] } }
      end
      let(:ferry) do
        box(
          "ferry-1",
          start: 0,
          finish: 1,
          category: "boats/ferry",
          frames: [keyframe(0, 0.1, 0.1, 0.2, 0.2), keyframe(1, 0.1, 0.1, 0.2, 0.2)]
        )
      end

      before do
        datasets << FakeExportContext::Dataset.new(
          id: "ds-2",
          name: "Harbour",
          labeling_configuration: harbour_configuration,
          entries: [FakeExportContext::Entry.new(id: "entry-2", name: "port.mp4", annotations: [ferry], meta:)]
        )
      end

      it "writes one COCO file per dataset" do
        export

        expect(annotation_files).to eq(%w[instances_Dataset.json instances_Harbour.json])
      end

      it "lists each dataset's own categories, from id 1" do
        export

        expect(coco_file("Dataset")[:categories].map { |c| [c[:id], c[:name]] })
          .to eq([[1, "vehicles/car"], [2, "road"]])
        expect(coco_file("Harbour")[:categories].map { |c| [c[:id], c[:name]] })
          .to eq([[1, "boats/ferry"], [2, "vehicles/car"]])
      end

      it "counts ids from 1 in each file" do
        export

        harbour = coco_file("Harbour")

        expect(harbour[:videos].map { |v| v[:id] }).to eq([1])
        expect(harbour[:images].map { |i| i[:id] }).to eq([1, 2])
        expect(harbour[:annotations].map { |a| [a[:id], a[:track_id], a[:category_id]] }).to eq([[1, 1, 1], [2, 1, 1]])
      end

      it "names files after the dataset, adding a suffix when two datasets share a name" do
        datasets.last.record.data[:attributes][:name] = "Dataset"

        exporter.export(context)

        expect(annotation_files).to eq(%w[instances_Dataset.json instances_Dataset_2.json])
      end

      it "leaves out a dataset without annotated frames, and reports it" do
        ferry.record.data[:attributes][:deleted_at] = "2026-01-01"

        export

        expect(annotation_files).to eq(%w[instances_Dataset.json])
        expect(report).to include(datasets: 1)
        expect(report[:skipped]).to eq(
          { deleted: 1, videos_without_annotated_frames: 1, datasets_without_annotated_frames: 1 }
        )
      end

      it "reports the whole export in one export_report.json" do
        export

        expect(report).to include(datasets: 2, videos: 2, images: 7)
      end
    end

    it "skips a shape drawn outside the video, which has no area once clamped" do
      car.record.shape_args[:frames] = [keyframe(0, 1.1, 0.1, 0.2, 0.2)]
      car.record.shape_args[:end] = 0

      exporter.export(context)

      expect(annotation_files).to eq([])
      expect(report[:skipped]).to include(zero_area: 1)
    end

    context "with a polygon of fewer than 3 points" do
      let(:annotations) do
        [car, FakeExportContext::Annotation.new(
          id: "line-1",
          shape_type: "idah-video:polygon",
          category: "road",
          shape_args: { start: 0, end: 0, frames: [{ frame: 0, angle: 0, points: [[0.1, 0.1], [0.5, 0.5]] }] }
        )]
      end

      it "skips it, since COCO tools would read it as a box" do
        expect(export[:annotations].map { |a| a[:attributes][:idah_id] }.uniq).to eq(["car-1"])
        expect(report[:skipped]).to include(too_few_points: 1)
      end
    end

    it "marks interpolated shapes keyframe: false" do
      expect(export[:annotations].map { |a| a[:attributes][:keyframe] }).to eq([true, false, false, false, true])
    end

    it "rotates a rotated box around its centre, with the bbox around the result" do
      # 200 x 100 px box centred on (200, 100), turned a quarter: 100 x 200 px.
      car.record.shape_args[:frames] = [keyframe(0, 0.1, 0.1, 0.2, 0.2, angle: Math::PI / 2)]
      car.record.shape_args[:end] = 0

      annotation = export[:annotations].first

      expect(annotation[:segmentation]).to eq([[250.0, 0.0, 250.0, 200.0, 150.0, 200.0, 150.0, 0.0]])
      expect(annotation[:bbox]).to eq([150.0, 0.0, 100.0, 200.0])
      expect(annotation[:area]).to eq(20_000.0)
      expect(annotation[:attributes][:rotation]).to eq(90.0)
    end

    it "clamps a box to the frame" do
      car.record.shape_args[:frames] = [keyframe(0, -0.1, 0.9, 0.2, 0.2)]
      car.record.shape_args[:end] = 0

      expect(export[:annotations].first[:bbox]).to eq([0.0, 450.0, 100.0, 50.0])
    end

    context "with a polygon" do
      let(:annotations) do
        [FakeExportContext::Annotation.new(
          id: "road-1",
          shape_type: "idah-video:polygon",
          category: "road",
          shape_args: { start: 2, end: 2,
                        frames: [{ frame: 2, angle: 0, points: [[0.1, 0.2], [0.5, 0.2], [0.5, 1.2]] }] }
        )]
      end

      it "writes its outline as segmentation, clamped to the frame, with its envelope and area" do
        expect(export[:annotations].first).to include(
          segmentation: [[100.0, 100.0, 500.0, 100.0, 500.0, 500.0]],
          bbox: [100.0, 100.0, 400.0, 400.0],
          area: 80_000.0,
          category_id: 2
        )
        expect(export[:annotations].first[:attributes]).to eq({ idah_id: "road-1", keyframe: true })
      end
    end

    context "with several shapes" do
      let(:annotations) do
        [
          car,
          box("car-2", start: 2, finish: 6, frames: [keyframe(2, 0.6, 0.6, 0.1, 0.1), keyframe(6, 0.6, 0.6, 0.1, 0.1)]),
          box(
            "car-3",
            start: 8,
            finish: 9,
            frames: [keyframe(8, 0.1, 0.1, 0.1, 0.1), keyframe(9, 0.1, 0.1, 0.1, 0.1)],
            metadata: { group_id: "car-1" }
          )
        ]
      end

      it "puts every shape visible on a frame on that frame's image, and exports only those frames" do
        coco = export

        per_frame = coco[:annotations].group_by { |a| frame_of(coco)[a[:image_id]] }.transform_values(&:size)

        expect(per_frame).to eq({ 0 => 1, 1 => 1, 2 => 2, 3 => 2, 4 => 2, 5 => 1, 6 => 1, 8 => 1, 9 => 1 })
        expect(frame_of(coco).values).to eq([0, 1, 2, 3, 4, 5, 6, 8, 9])
      end

      it "gives annotations of the same group one track id, unique in the export" do
        coco = export

        tracks = coco[:annotations].group_by { |a| a[:attributes][:idah_id] }.transform_values do |anns|
          anns.map { |a| a[:track_id] }.uniq
        end

        expect(tracks).to eq({ "car-1" => [1], "car-2" => [2], "car-3" => [1] })
      end
    end

    context "with a group whose rows have different categories" do
      let(:annotations) do
        [
          car,
          box(
            "car-1-later",
            start: 5,
            finish: 6,
            frames: [keyframe(5, 0.5, 0.1, 0.2, 0.2), keyframe(6, 0.5, 0.1, 0.2, 0.2)],
            category: "road",
            metadata: { group_id: "car-1" }
          )
        ]
      end

      it "splits it into one track per category" do
        tracks = export[:annotations].group_by { |a| a[:track_id] }.transform_values do |anns|
          anns.map { |a| a[:category_id] }.uniq
        end

        expect(tracks).to eq({ 1 => [1], 2 => [2] })
      end

      it "lists the split group in the report" do
        export

        expect(report[:split_groups]).to eq(
          [{ dataset: "Dataset", video: "street.mp4", idah_entry_id: "entry-1", group: "car-1",
             tracks: [{ category: "vehicles/car", track_id: 1 }, { category: "road", track_id: 2 }] }]
        )
      end
    end

    context "with entry-level and frame tags" do
      let(:annotations) do
        [
          car,
          FakeExportContext::Annotation.new(
            id: "root",
            shape_type: "entry:root",
            category: "rain",
            shape_args: {},
            properties: { visibility: "low" }
          ),
          FakeExportContext::Annotation.new(
            id: "tag-1",
            shape_type: "idah-video:frame",
            category: "night",
            shape_args: { start: 7, end: 7, frames: [{ frame: 7, points: [] }] },
            properties: { lighting: "street lamps" }
          ),
          FakeExportContext::Annotation.new(
            id: "tag-2",
            shape_type: "idah-video:frame",
            category: "rain",
            shape_args: { start: 7, end: 7, frames: [{ frame: 7, points: [] }] }
          )
        ]
      end

      it "stores the entry-level category and properties on the video" do
        expect(export[:videos].first[:attributes]).to eq({ category: "rain", visibility: "low" })
      end

      it "stores frame tags on the frame's image, exporting a tagged frame without shapes too" do
        images = export[:images].to_h { |i| [i[:frame_id], i] }

        expect(images.keys).to eq([0, 1, 2, 3, 4, 7])
        expect(images[7][:attributes]).to eq(
          { frame_tags: [{ category: "night", lighting: "street lamps" }, { category: "rain" }] }
        )
        expect(images[1]).not_to have_key(:attributes)
      end
    end

    it "lists each video with its size, frame rate, frame count and IDAH ids" do
      expect(export[:videos]).to eq(
        [{ id: 1, name: "street.mp4", width: 1000, height: 500, fps: 25.0, length: 100,
           idah_entry_id: "entry-1", idah_dataset_id: "ds-1" }]
      )
    end

    it "names an unnamed entry's image folder after its uploaded file" do
      entries.replace(
        [FakeExportContext::Entry.new(id: "entry-1", name: nil, annotations: [car], meta:, filename: "harbour cam.mov")]
      )

      expect(export[:images].first[:file_name]).to eq("harbour_cam/frame_000000.jpg")
    end

    it "names image folders after the entry, adding a suffix when two entries share a name" do
      entries << FakeExportContext::Entry.new(id: "entry-2", name: "street.mp4", annotations: [car], meta:)

      folders = export[:images].map { |i| File.dirname(i[:file_name]) }.uniq

      expect(folders).to eq(%w[street street_2])
    end

    it "leaves out a video without annotated frames, and reports it" do
      entries << FakeExportContext::Entry.new(id: "entry-2", name: "empty.mp4", annotations: [], meta:)

      expect(export[:images].map { |i| File.dirname(i[:file_name]) }.uniq).to eq(["street"])
      expect(report).to include(videos: 1, skipped: { videos_without_annotated_frames: 1 })
    end

    it "exports only completed entries unless told otherwise" do
      entries << FakeExportContext::Entry.new(
        id: "entry-2",
        name: "draft.mp4",
        annotations: [car],
        meta:,
        status: "in_progress"
      )

      expect(export[:images].map { |i| File.dirname(i[:file_name]) }.uniq).to eq(["street"])
    end

    context "with completed_entries: false" do
      let(:options) { { completed_entries: false } }

      it "exports every entry" do
        entries << FakeExportContext::Entry.new(
          id: "entry-2",
          name: "draft.mp4",
          annotations: [car],
          meta:,
          status: "in_progress"
        )

        expect(export[:images].map { |i| File.dirname(i[:file_name]) }.uniq).to eq(%w[street draft])
      end
    end

    describe "frame images" do
      # 10 frames at 10 fps.
      let(:video) do
        path = File.join(Dir.tmpdir, "idah-coco-spec-#{Process.pid}.mp4")
        _, err, status = Open3.capture3(
          "ffmpeg",
          "-y",
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "testsrc=s=64x32:r=10:d=1",
          "-pix_fmt",
          "yuv420p",
          path
        )
        raise err unless status.success?

        path
      end

      let(:entries) do
        [FakeExportContext::Entry.new(id: "entry-1", name: "street.mp4", annotations:, meta:, video:)]
      end

      after { FileUtils.rm_f(video) }

      def image_files
        Dir.glob("**/*.jpg", base: File.join(context.io.directory, "images", "Dataset")).sort
      end

      %w[original all].each do |include_medias|
        context "with include_medias: #{include_medias}" do
          let(:options) { { include_medias: } }

          it "writes an image for every exported frame, at its file_name" do
            coco = export

            expect(image_files).to eq(coco[:images].map { |i| i[:file_name] })
            expect(report[:image_files]).to eq(5)
          end
        end
      end

      context "with include_medias: none" do
        let(:options) { { include_medias: "none" } }

        it "writes labels only" do
          export

          expect(Dir.exist?(File.join(context.io.directory, "images"))).to be(false)
        end
      end

      context "when the video cannot be read" do
        let(:options) { { include_medias: "original" } }

        it "keeps the labels, writes no images and reports it" do
          File.write(video, "not a video")

          coco = export

          expect(coco[:annotations].size).to eq(5)
          expect(image_files).to be_empty
          expect(report[:warnings]).to eq(
            ["Entry `street.mp4` (entry-1): no images, the video could not be read (RuntimeError)."]
          )
        end
      end

      context "when a shape runs past the end of the video" do
        let(:options) { { include_medias: "original" } }

        it "writes the frames the video has and reports the others" do
          car.record.shape_args[:frames] << keyframe(12, 0.5, 0.1, 0.2, 0.2)
          car.record.shape_args[:end] = 12

          export

          expect(image_files.size).to eq(10)
          expect(report[:warnings]).to eq(
            ["Entry `street.mp4` (entry-1): 3 frames past the end of the video have no image."]
          )
        end
      end
    end

    describe "skipped data" do
      let(:annotations) do
        [
          car,
          box("deleted", start: 0, finish: 0, frames: [keyframe(0, 0.1, 0.1, 0.1, 0.1)], deleted_at: "2026-01-01"),
          box("no-category", start: 0, finish: 0, frames: [keyframe(0, 0.1, 0.1, 0.1, 0.1)], category: nil),
          box("no-keyframes", start: 0, finish: 4, frames: []),
          FakeExportContext::Annotation.new(id: "line", shape_type: "idah-video:line", category: "road", shape_args: {})
        ]
      end

      it "leaves them out and counts them in export_report.json" do
        coco = export

        expect(coco[:annotations].size).to eq(5)
        expect(report).to include(
          videos: 1,
          images: 5,
          annotations: 5,
          interpolated_annotations: 3,
          skipped: { deleted: 1, no_category: 1, no_keyframes: 1, "unsupported_shape_type:idah-video:line": 1 }
        )
      end
    end

    it "skips an entry whose video size is unknown, and reports it" do
      entries << FakeExportContext::Entry.new(id: "entry-2", name: "broken.mp4", annotations: [car], meta: nil)

      export

      expect(report[:warnings]).to eq(["Entry `broken.mp4` (entry-2) skipped: video width and height are unknown."])
    end

    it "refuses datasets of another modality" do
      datasets << FakeExportContext::Dataset.new(id: "ds-2", entries: [], modality: "idah-image")

      expect { exporter.export(context) }.to raise_error(ArgumentError, /idah-image/)
    end
  end
end
