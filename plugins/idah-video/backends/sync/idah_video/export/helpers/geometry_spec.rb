# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::Export::Helpers::Geometry do
  describe ".to_pixels" do
    it "scales normalized points to the video size" do
      expect(described_class.to_pixels([[0.5, 0.25], [1, 1]], 1920, 1080)).to eq([[960.0, 270.0], [1920.0, 1080.0]])
    end
  end

  describe ".clamp" do
    it "keeps points inside the frame" do
      expect(described_class.clamp([[-5.0, 10.0], [2000.0, 1100.0]], 1920, 1080))
        .to eq([[0.0, 10.0], [1920.0, 1080.0]])
    end
  end

  describe ".envelope" do
    it "returns the axis-aligned box as [x, y, width, height]" do
      expect(described_class.envelope([[10.0, 20.0], [50.0, 25.0], [30.0, 80.0]])).to eq([10.0, 20.0, 40.0, 60.0])
    end
  end

  describe ".polygon_area" do
    it "returns the area whatever the point order" do
      square = [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]]

      expect(described_class.polygon_area(square)).to eq(100.0)
      expect(described_class.polygon_area(square.reverse)).to eq(100.0)
    end
  end

  describe ".flatten" do
    it "flattens points to COCO's [x1, y1, x2, y2, ...] rounded to 2 decimals" do
      expect(described_class.flatten([[1.234, 5.678], [9.0, 10.005]])).to eq([1.23, 5.68, 9.0, 10.01])
    end
  end

  describe ".degrees" do
    it "converts radians to degrees between 0 and 360" do
      expect(described_class.degrees(Math::PI / 2)).to eq(90.0)
      expect(described_class.degrees(-Math::PI / 2)).to eq(270.0)
      expect(described_class.degrees(0)).to eq(0.0)
    end
  end

  describe ".rotate" do
    it "turns points around their centroid, clockwise on screen" do
      square = [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]]

      rotated = described_class.rotate(square, Math::PI / 2).map { |p| p.map { |v| v.round(9) } }

      expect(rotated).to eq([[10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]])
    end
  end
end
