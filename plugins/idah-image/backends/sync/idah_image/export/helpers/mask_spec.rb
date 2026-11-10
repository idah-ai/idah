# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahImage::Export::Helpers::Mask do
  def mask(pixels, width: 300, height: 200)
    described_class.decode(MaskTiles.shape_args(pixels), width, height)
  end

  def rect(x0, y0, x1, y1) = (x0...x1).to_a.product((y0...y1).to_a)

  # The pixels whose centres the polygons cover, each by the even-odd rule,
  # as a polygon fill would set them.
  def fill(polygons, width, height)
    polygons.flat_map do |points|
      (0...width).to_a.product((0...height).to_a).select do |x, y|
        px = x + 0.5
        py = y + 0.5
        points.each_with_index.count do |(x1, y1), i|
          x2, y2 = points[i - 1]
          (y1 > py) != (y2 > py) && px < x1 + ((py - y1) * (x2 - x1) / (y2 - y1).to_f)
        end.odd?
      end
    end.uniq
  end

  describe ".runs" do
    it "reads the frontend's run encoding" do
      # rle.ts: 5 zeros, 3 ones, rest zeros -> runs [5, 3] -> "BQM="
      expect(described_class.runs("BQM=")).to eq([5, 3])
    end

    it "reads 2-byte runs" do
      expect(described_class.runs([[0x81, 0x2c, 7].pack("C*")].pack("m0"))).to eq([300, 7])
    end
  end

  describe ".decode" do
    it "places each tile's pixels in the image" do
      pixels = rect(120, 10, 140, 20) # crosses from tile 0x0 into tile 1x0
      mask = mask(pixels)

      expect(mask.area).to eq(200)
      expect(mask.bbox).to eq([120, 10, 20, 10])
    end

    it "ignores pixels past the edge of the image" do
      mask = mask(rect(290, 190, 310, 210), width: 300, height: 200)

      expect(mask.area).to eq(100)
      expect(mask.bbox).to eq([290, 190, 10, 10])
    end

    it "is empty without tiles" do
      mask = described_class.decode({ points: [] }, 300, 200)

      expect(mask).to be_empty
      expect(mask.area).to eq(0)
    end
  end

  describe "#each_span" do
    it "yields each run of set pixels in image pixels" do
      mask = mask(rect(130, 5, 134, 6) + [[140, 5], [2, 9]])

      expect(mask.enum_for(:each_span).to_a).to eq([[5, 130, 4], [5, 140, 1], [9, 2, 1]])
    end
  end

  describe "#coco_rle" do
    it "counts runs column by column, starting with 0s, as pycocotools does" do
      # 4 x 3 image, pixels (1,0), (1,1) and (2,2) set:
      # column 0: 000, column 1: 110, column 2: 001, column 3: 000
      mask = mask([[1, 0], [1, 1], [2, 2]], width: 4, height: 3)

      # runs [3, 2, 3, 1, 3]
      expect(mask.coco_rle).to eq({ size: [3, 4], counts: "323O0" })
    end

    it "starts with an empty run when the first pixel is set" do
      mask = mask([[0, 0]], width: 2, height: 2)

      # runs [0, 1, 3]
      expect(mask.coco_rle).to eq({ size: [2, 2], counts: "013" })
    end
  end

  describe ".compress" do
    it "packs runs as pycocotools does, large runs and falling ones included" do
      # The expected strings come from pycocotools' frPyObjects.
      expect(described_class.compress([3, 2, 3, 1, 3])).to eq("323O0")
      expect(described_class.compress([207_360, 12, 1068, 14, 500, 791_546])).to eq("P`Z6<\\Q12X^O\\oTh0")
    end
  end

  describe "#outlines" do
    it "traces each separate piece as a polygon around its pixels" do
      mask = mask(rect(10, 10, 20, 15) + rect(50, 50, 53, 53))

      outlines = mask.outlines.sort_by { |points| points.map(&:first).min }

      expect(outlines.size).to eq(2)
      expect(outlines.first).to match_array([[10, 10], [20, 10], [20, 15], [10, 15]])
      expect(outlines.last).to match_array([[50, 50], [53, 50], [53, 53], [50, 53]])
    end

    it "joins a hole to its piece by a zero-width cut" do
      ring = rect(10, 10, 30, 30) - rect(15, 15, 25, 25)

      outlines = mask(ring).outlines

      expect(outlines.size).to eq(1)
      expect(outlines.first.uniq).to match_array(
        [[10, 10], [30, 10], [30, 30], [10, 30], [15, 15], [25, 15], [25, 25], [15, 25]]
      )
      # The hole runs the other way, the cut there and back: 400 - 100.
      expect(IdahImage::Export::Helpers::Geometry.polygon_area(outlines.first)).to eq(300)
    end

    it "keeps pieces touching at a corner apart" do
      outlines = mask(rect(10, 10, 20, 20) + rect(20, 20, 30, 30)).outlines

      expect(outlines.map(&:sort)).to contain_exactly(
        [[10, 10], [10, 20], [20, 10], [20, 20]], [[20, 20], [20, 30], [30, 20], [30, 30]]
      )
    end

    it "leaves holes out when asked" do
      ring = rect(10, 10, 30, 30) - rect(15, 15, 25, 25)

      expect(mask(ring).outlines(holes: false)).to contain_exactly(
        match_array([[10, 10], [30, 10], [30, 30], [10, 30]])
      )
    end

    it "fills back to the mask's pixels, holes and an island in a hole included" do
      pixels = rect(10, 10, 60, 40) - rect(15, 15, 25, 25) - rect(35, 15, 50, 30) + rect(18, 18, 22, 22)

      outlines = mask(pixels).outlines

      expect(outlines.size).to eq(2)
      expect(fill(outlines, 300, 200)).to match_array(pixels)
    end

    it "joins many holes, each once" do
      grid = rect(0, 0, 101, 101) - (0...10).to_a.product((0...10).to_a).flat_map do |i, j|
        rect((i * 10) + 2, (j * 10) + 2, (i * 10) + 9, (j * 10) + 9)
      end

      outlines = mask(grid).outlines

      expect(outlines.size).to eq(1)
      expect(fill(outlines, 300, 200)).to match_array(grid)
    end

    it "simplifies a staircase edge" do
      triangle = (0...40).flat_map { |y| (0..y).map { |x| [x + 5, y + 5] } }

      outline = mask(triangle).outlines.first

      expect(outline.size).to be < 10
      expect(IdahImage::Export::Helpers::Geometry.polygon_area(outline)).to be_within(40).of(triangle.size)
    end
  end
end
