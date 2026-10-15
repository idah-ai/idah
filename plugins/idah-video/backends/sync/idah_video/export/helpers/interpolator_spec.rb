# frozen_string_literal: true

require "spec_helper"
require "json"

RSpec.describe IdahVideo::Export::Helpers::Interpolator do
  let(:box_args) do
    {
      start: 10,
      end: 20,
      frames: [
        { frame: 10, angle: 0, points: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.2], [0.1, 0.2]] },
        { frame: 20, angle: 0.5, points: [[0.5, 0.1], [0.7, 0.1], [0.7, 0.2], [0.5, 0.2]] }
      ]
    }
  end

  describe ".at" do
    it "returns the stored keyframe as it is" do
      geometry = described_class.at("idah-video:bounding-box", box_args, 10)

      expect(geometry.points).to eq([[0.1, 0.1], [0.3, 0.1], [0.3, 0.2], [0.1, 0.2]])
      expect(geometry.angle).to eq(0.0)
      expect(geometry.keyframe).to be(true)
    end

    it "interpolates a bounding box and its angle between two keyframes" do
      geometry = described_class.at("idah-video:bounding-box", box_args, 15)

      expect(geometry.points.map { |x, y| [x.round(10), y.round(10)] })
        .to eq([[0.3, 0.1], [0.5, 0.1], [0.5, 0.2], [0.3, 0.2]])
      expect(geometry.angle).to eq(0.25)
      expect(geometry.keyframe).to be(false)
    end

    it "returns nil outside the annotation's frame range" do
      expect(described_class.at("idah-video:bounding-box", box_args, 9)).to be_nil
      expect(described_class.at("idah-video:bounding-box", box_args, 21)).to be_nil
    end

    it "returns nil inside the range but before the first or after the last keyframe" do
      args = box_args.merge(start: 0, end: 30)

      expect(described_class.at("idah-video:bounding-box", args, 5)).to be_nil
      expect(described_class.at("idah-video:bounding-box", args, 25)).to be_nil
    end

    it "returns nil when the annotation has no keyframes" do
      expect(described_class.at("idah-video:bounding-box", box_args.merge(frames: []), 15)).to be_nil
    end

    it "returns nil when the keyframe has no points" do
      args = box_args.merge(frames: [{ frame: 10, angle: 0, points: [] }])

      expect(described_class.at("idah-video:bounding-box", args, 10)).to be_nil
    end

    it "treats a missing angle as 0" do
      args = box_args.merge(frames: box_args[:frames].map { |f| f.except(:angle) })

      expect(described_class.at("idah-video:bounding-box", args, 15).angle).to eq(0.0)
    end

    it "reads shape args with string keys" do
      args = JSON.parse(box_args.to_json)

      expect(described_class.at("idah-video:bounding-box", args, 15).angle).to eq(0.25)
    end

    it "interpolates a polygon with an angle of 0" do
      args = box_args.merge(frames: box_args[:frames].map { |f| f.merge(angle: 1) })

      geometry = described_class.at("idah-video:polygon", args, 15)

      expect(geometry.points.size).to eq(4)
      expect(geometry.angle).to eq(0.0)
    end

    it "rejects a shape type it cannot interpolate" do
      expect { described_class.at("idah-video:frame", box_args, 15) }.to raise_error(ArgumentError)
    end
  end

  # The frontend draws interpolated frames with getInterpolatedFrame and flubber.
  # These fixtures are generated from that code (see the note in the file), so
  # the export matches what annotators see, number for number.
  describe "parity with the frontend" do
    fixtures = JSON.parse(
      File.read(File.expand_path("../../../../spec_data/interpolation_parity.json", __dir__))
    )

    fixtures["cases"].each do |fixture|
      context fixture["name"] do
        fixture["results"].each do |result|
          it "matches at frame #{result["frame"]}" do
            geometry = described_class.at(fixture["shape_type"], fixture["shape_args"], result["frame"])
            expected = result["expected"]

            if expected.nil?
              expect(geometry).to be_nil
            else
              expect(geometry.points).to eq(expected["points"])
              expect(geometry.angle).to eq(expected["angle"])
            end
          end
        end
      end
    end
  end
end
