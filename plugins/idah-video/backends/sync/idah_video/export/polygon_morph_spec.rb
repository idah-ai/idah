# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::Export::PolygonMorph do
  # Clockwise in screen space: d3's polygonArea is negative for it, so flubber
  # leaves it as it is.
  let(:square) { [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]] }
  let(:moved_square) { [[0.2, 0.2], [0.5, 0.2], [0.5, 0.5], [0.2, 0.5]] }

  describe ".interpolate" do
    it "moves each point linearly when both polygons have the same points" do
      result = described_class.interpolate(square, moved_square, 0.5)

      expect(result).to eq(
        [[0.15000000000000002, 0.15000000000000002], [0.45, 0.15000000000000002],
         [0.45, 0.45], [0.15000000000000002, 0.45]]
      )
    end

    it "returns the first polygon at t = 0 and the second at t = 1" do
      expect(described_class.interpolate(square, moved_square, 0)).to eq(square)
      expect(described_class.interpolate(square, moved_square, 1)).to eq(moved_square)
    end

    it "adds points to the smaller polygon until both have the same count" do
      triangle = [[0.5, 0.1], [0.8, 0.7], [0.2, 0.7]]
      hexagon = [[0.5, 0.2], [0.7, 0.3], [0.7, 0.6], [0.5, 0.7], [0.3, 0.6], [0.3, 0.3]]

      expect(described_class.interpolate(triangle, hexagon, 0.5).size).to eq(6)
      expect(described_class.interpolate(hexagon, triangle, 0.5).size).to eq(6)
    end

    it "drops a closing point that repeats the first" do
      closed = square + [square.first]

      expect(described_class.interpolate(closed, moved_square, 0)).to eq(square)
    end

    it "reverses a counter-clockwise polygon so both run the same way" do
      result = described_class.interpolate(square.reverse, moved_square, 0)

      expect(result).to eq(square)
    end

    it "aligns the starting point with the closest vertex of the second polygon" do
      shifted = moved_square.rotate(2)

      result = described_class.interpolate(square, shifted, 0)

      expect(result).to eq(square.rotate(2))
    end

    it "accepts integer coordinates" do
      result = described_class.interpolate([[0, 0], [2, 0], [2, 2], [0, 2]], [[1, 1], [3, 1], [3, 3], [1, 3]], 0.5)

      expect(result).to eq([[0.5, 0.5], [2.5, 0.5], [2.5, 2.5], [0.5, 2.5]])
    end

    it "rejects a polygon without points" do
      expect { described_class.interpolate([], square, 0.5) }.to raise_error(ArgumentError)
    end

    it "rejects a point that is not a pair of numbers" do
      expect { described_class.interpolate([[0.1, "a"], [0.2, 0.2], [0.3, 0.1]], square, 0.5) }
        .to raise_error(ArgumentError)
    end
  end
end
