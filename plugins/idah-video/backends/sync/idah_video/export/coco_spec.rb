# frozen_string_literal: true

require "spec_helper"
require "json"
require "yaml"
require "open3"
require "tmpdir"

RSpec.describe IdahVideo::Export::Coco do
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

  # Runs the export and returns the first video's COCO file.
  def export
    exporter.export(context)
    subsets.values.first
  end

  # Every annotation file, by subset name.
  def subsets
    Dir.glob(File.join(context.io.directory, "annotations", "instances_*.json")).sort.to_h do |path|
      [File.basename(path, ".json").delete_prefix("instances_"), JSON.parse(File.read(path), symbolize_names: true)]
    end
  end

  def video_names
    subsets.values.map { |coco| coco[:info][:video][:name] }
  end

  def report
    YAML.safe_load_file(File.join(context.io.directory, "export_report.yml"), symbolize_names: true)
  end

  describe "metadata" do
    it "describes the format" do
      expect(exporter.name).to eq("COCO 1.0 (Video)")
      expect(exporter.description).to be_a(String)
      expect(exporter.options).to eq(Verse::Schema.empty)
    end
  end

  describe "#export" do
    it "writes each video as its own subset, which CVAT imports as its own task" do
      export

      expect(Dir.children(File.join(context.io.directory, "annotations"))).to eq(["instances_street.json"])
    end

    # CVAT parses every JSON file of an imported zip as COCO.
    it "writes no JSON file besides the annotations" do
      export

      expect(Dir.glob("**/*.json", base: context.io.directory)).to eq(["annotations/instances_street.json"])
    end

    it "writes one image per frame the track covers, with interpolated frames in between" do
      coco = export

      expect(coco[:images].map { |i| [i[:file_name], i[:frame_id]] }).to eq(
        (0..4).map { |f| [format("frame_%06d.jpg", f), f] }
      )
      expect(coco[:images].first).to include(width: 1000, height: 500, license: 0)
      expect(coco[:annotations].map { |a| a[:attributes][:keyframe] }).to eq([true, false, false, false, true])
    end

    it "writes boxes in pixels as [x, y, width, height] without segmentation, as CVAT does" do
      first, second = export[:annotations]

      expect(first).to include(
        image_id: 1,
        category_id: 1,
        bbox: [100.0, 50.0, 200.0, 100.0],
        segmentation: [],
        area: 20_000.0,
        iscrowd: 0
      )
      expect(second[:bbox]).to eq([200.0, 50.0, 200.0, 100.0])
    end

    it "keeps track identity, properties and CVAT's occluded flag in attributes" do
      attributes = export[:annotations].map { |a| a[:attributes] }

      expect(attributes.map { |a| a[:track_id] }.uniq).to eq([0])
      expect(attributes.first).to include(occluded: false, color: "red", rotation: 0.0)
    end

    it "writes a rotated box unrotated, with its angle in degrees as CVAT's rotation attribute" do
      car.record.shape_args[:frames] = [keyframe(0, 0.1, 0.1, 0.2, 0.2, angle: Math::PI / 2)]
      car.record.shape_args[:end] = 0

      annotation = export[:annotations].first

      expect(annotation[:bbox]).to eq([100.0, 50.0, 200.0, 100.0])
      expect(annotation[:attributes][:rotation]).to eq(90.0)
    end

    it "clamps an unrotated box to the frame" do
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
        annotation = export[:annotations].first

        expect(annotation).to include(
          segmentation: [[100.0, 100.0, 500.0, 100.0, 500.0, 500.0]],
          bbox: [100.0, 100.0, 400.0, 400.0],
          area: 80_000.0,
          category_id: 2
        )
        expect(annotation[:attributes]).not_to have_key(:rotation)
      end
    end

    context "with several tracks" do
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

      it "puts every track visible on a frame on that frame's image" do
        coco = export

        frame_ids = coco[:images].to_h { |i| [i[:id], i[:frame_id]] }
        per_frame = coco[:annotations].group_by { |a| frame_ids[a[:image_id]] }.transform_values(&:size)

        expect(per_frame).to eq({ 0 => 1, 1 => 1, 2 => 2, 3 => 2, 4 => 2, 5 => 1, 6 => 1, 8 => 1, 9 => 1 })
      end

      it "exports the frame after a track ends, without annotations, so CVAT ends the track there" do
        coco = export

        # car-2 ends at frame 6 and nothing else is on frame 7, but frame 8 is
        # exported: without frame 7, CVAT would join car-2 straight onto frame 8.
        frames = coco[:images].map { |i| i[:frame_id] }
        empty_frame = coco[:images].find { |i| i[:frame_id] == 7 }

        expect(frames).to eq([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        expect(coco[:annotations].count { |a| a[:image_id] == empty_frame[:id] }).to eq(0)
        expect(report[:track_end_frames]).to eq(1)
      end

      it "gives annotations of the same group one track id" do
        coco = export

        track_ids = coco[:annotations].to_h { |a|
          [coco[:images][a[:image_id] - 1][:frame_id], a[:attributes][:track_id]]
        }

        expect(track_ids.values_at(0, 9)).to eq([0, 0])
        expect(track_ids[5]).to eq(1)
      end
    end

    describe "occlusion" do
      {
        "Partial" => true,
        "FULL" => true,
        " full " => true,
        ["Partial"] => true,
        ["", "FULL"] => true,
        "" => false,
        [""] => false,
        nil => false,
        "unknown" => false
      }.each do |value, occluded|
        it "sets CVAT's occluded flag to #{occluded} for an occlusion of #{value.inspect}" do
          car.record.data[:attributes][:properties] = value.nil? ? {} : { occlusion: value }

          attributes = export[:annotations].first[:attributes]

          expect(attributes[:occluded]).to be(occluded)
        end
      end

      it "keeps the occlusion property as it is" do
        car.record.data[:attributes][:properties] = { occlusion: "FULL" }

        expect(export[:annotations].first[:attributes]).to include(occlusion: "FULL", occluded: true)
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

      it "splits it into one track per category, since a CVAT track has one label, and reports it" do
        coco = export

        tracks = coco[:annotations].group_by { |a| a[:attributes][:track_id] }.transform_values do |anns|
          anns.map { |a| a[:category_id] }.uniq
        end

        expect(tracks).to eq({ 0 => [1], 1 => [2] })
        expect(report[:warnings]).to eq(
          ["Entry `street.mp4` (entry-1): group car-1 has 2 categories (vehicles/car, road), exported as 2 tracks."]
        )
      end
    end

    context "with rows of one track on the same frames" do
      let(:annotations) do
        [
          car,
          box(
            "car-1-copy",
            start: 3,
            finish: 5,
            frames: [keyframe(3, 0.5, 0.1, 0.2, 0.2), keyframe(5, 0.5, 0.1, 0.2, 0.2)],
            metadata: { group_id: "car-1" }
          )
        ]
      end

      it "keeps the first shape on each frame, since CVAT rejects a track twice on one frame" do
        coco = export

        frame_ids = coco[:images].to_h { |i| [i[:id], i[:frame_id]] }

        expect(coco[:annotations].map { |a| frame_ids[a[:image_id]] }).to eq([0, 1, 2, 3, 4, 5])
        expect(report[:skipped]).to eq({ duplicate_track_frames: 2 })
      end
    end

    describe "video records" do
      it "describes each video with its size, frame rate and frame count" do
        expect(export[:info][:video]).to eq({ name: "street.mp4", width: 1000, height: 500, fps: 25.0, length: 100 })
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
              shape_args: { start: 2, end: 2, frames: [{ frame: 2, points: [] }] }
            ),
            FakeExportContext::Annotation.new(
              id: "tag-2",
              shape_type: "idah-video:frame",
              category: "night",
              shape_args: { start: 7, end: 7, frames: [{ frame: 7, points: [] }] }
            )
          ]
        end

        it "stores the entry-level category and properties on the video" do
          expect(export[:info][:video][:attributes]).to eq({ category: "rain", visibility: "low" })
        end

        it "stores frame tags on the frame's image, exporting a tagged frame without tracks too" do
          images = export[:images].to_h { |i| [i[:frame_id], i] }

          expect(images[2][:attributes]).to eq({ frame_tags: ["night"] })
          expect(images[7][:attributes]).to eq({ frame_tags: ["night"] })
          expect(images[1]).not_to have_key(:attributes)
        end
      end
    end

    it "names an unnamed entry after its uploaded file" do
      entries.replace(
        [FakeExportContext::Entry.new(
          id: "entry-1",
          name: nil,
          annotations: [car],
          meta:,
          filename: "harbour cam.mov"
        )]
      )

      coco = export

      expect(coco[:info][:video][:name]).to eq("harbour cam.mov")
      expect(subsets.keys).to eq(["harbour_cam"])
    end

    it "names subsets after the entry, adding a suffix when two entries share a name" do
      entries << FakeExportContext::Entry.new(id: "entry-2", name: "street.mp4", annotations: [car], meta:)

      export

      expect(subsets.keys).to eq(%w[street street_2])
      expect(subsets.values.map { |coco| coco[:info][:video][:name] }).to eq(["street.mp4", "street.mp4"])
    end

    it "counts track ids from 0 in each video" do
      entries << FakeExportContext::Entry.new(id: "entry-2", name: "harbour.mp4", annotations: [car], meta:)

      export

      expect(subsets.values.map { |coco| coco[:annotations].map { |a| a[:attributes][:track_id] }.uniq })
        .to eq([[0], [0]])
    end

    it "leaves out a video without annotated frames, and reports it" do
      entries << FakeExportContext::Entry.new(id: "entry-2", name: "empty.mp4", annotations: [], meta:)

      export

      expect(subsets.keys).to eq(["street"])
      expect(report[:skipped]).to eq({ videos_without_annotated_frames: 1 })
    end

    it "exports only completed entries unless told otherwise" do
      entries << FakeExportContext::Entry.new(
        id: "entry-2",
        name: "draft.mp4",
        annotations: [car],
        meta:,
        status: "in_progress"
      )

      export

      expect(video_names).to eq(["street.mp4"])
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

        export

        expect(video_names).to contain_exactly("street.mp4", "draft.mp4")
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
        Dir.glob("**/*.jpg", base: File.join(context.io.directory, "images")).sort
      end

      %w[original all].each do |include_medias|
        context "with include_medias: #{include_medias}" do
          let(:options) { { include_medias: } }

          it "writes an image for every exported frame, at its file_name" do
            coco = export

            expect(image_files).to eq(coco[:images].map { |i| "street/#{i[:file_name]}" })
            expect(report[:image_files]).to eq(5)
          end
        end
      end

      context "with include_medias: none" do
        let(:options) { { include_medias: "none" } }

        it "writes labels only" do
          export

          expect(image_files).to be_empty
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

      context "when a track runs past the end of the video" do
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
          FakeExportContext::Annotation.new(
            id: "line",
            shape_type: "idah-video:line",
            category: "road",
            shape_args: {}
          )
        ]
      end

      it "leaves them out and counts them in export_report.yml" do
        coco = export

        expect(coco[:annotations].size).to eq(5)
        expect(report).to include(
          videos: 1,
          images: 5,
          annotations: 5,
          interpolated_annotations: 3,
          skipped: { deleted: 1, no_category: 1, "unsupported_shape_type:idah-video:line": 1 }
        )
      end
    end

    it "skips an entry whose video size is unknown, and reports it" do
      entries << FakeExportContext::Entry.new(id: "entry-2", name: "broken.mp4", annotations: [car], meta: nil)

      export

      expect(video_names).to eq(["street.mp4"])
      expect(report[:warnings]).to eq(["Entry `broken.mp4` (entry-2) skipped: video width and height are unknown."])
    end

    it "refuses datasets of another modality" do
      datasets << FakeExportContext::Dataset.new(id: "ds-2", entries: [], modality: "idah-image")

      expect { exporter.export(context) }.to raise_error(ArgumentError, /idah-image/)
    end
  end
end
