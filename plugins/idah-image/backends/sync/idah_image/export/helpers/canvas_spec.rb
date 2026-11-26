# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahImage::Export::Helpers::Canvas do
  subject(:canvas) { described_class.new(10, 8) }

  # The canvas as rows of digits, for readable expectations.
  def rows = canvas.pixels.unpack("C*").each_slice(canvas.width).map(&:join)

  it "starts as background" do
    expect(canvas.pixels.bytesize).to eq(80)
    expect(canvas).to be_empty
  end

  describe "#fill_polygon" do
    it "sets the pixels whose centres lie inside" do
      canvas.fill_polygon([[1, 1], [4, 1], [4, 3], [1, 3]], 2)

      expect(rows.first(4)).to eq(%w[0000000000 0222000000 0222000000 0000000000])
      expect(canvas).not_to be_empty
    end

    it "keeps shapes sharing an edge apart" do
      canvas.fill_polygon([[0, 0], [5, 0], [5, 2], [0, 2]], 1)
      canvas.fill_polygon([[5, 0], [10, 0], [10, 2], [5, 2]], 2)

      expect(rows.first(2)).to eq(%w[1111122222 1111122222])
    end

    it "fills a triangle by the even-odd rule" do
      canvas.fill_polygon([[0, 0], [8, 0], [0, 8]], 3)

      expect(rows.first(3)).to eq(%w[3333333000 3333330000 3333300000])
    end

    it "clips to the image" do
      canvas.fill_polygon([[-5, -5], [20, -5], [20, 20], [-5, 20]], 1)

      expect(rows.uniq).to eq(["1111111111"])
    end

    it "lets a later shape win where shapes overlap" do
      canvas.fill_polygon([[0, 0], [6, 0], [6, 2], [0, 2]], 1)
      canvas.fill_polygon([[4, 0], [10, 0], [10, 2], [4, 2]], 2)

      expect(rows.first).to eq("1111222222")
    end
  end

  describe "#outline_polygon" do
    it "sets the edge pixels of the fill, 1 pixel thick" do
      canvas.fill_polygon([[1, 1], [6, 1], [6, 5], [1, 5]], 9)
      filled = rows
      canvas.pixels.replace("\x00".b * 80)

      canvas.outline_polygon([[1, 1], [6, 1], [6, 5], [1, 5]], 2)

      expect(rows[0..5]).to eq(%w[0000000000 0222220000 0200020000 0200020000 0222220000 0000000000])
      # Only where the fill is.
      expect(rows.join.chars.zip(filled.join.chars).select { |o, _| o == "2" }.map(&:last).uniq).to eq(["9"])
    end

    it "outlines along the image edge where the polygon is cut" do
      canvas.outline_polygon([[-5, -5], [3, -5], [3, 3], [-5, 3]], 1)

      expect(rows.first(4)).to eq(%w[1110000000 1010000000 1110000000 0000000000])
    end
  end

  describe "#stroke_line" do
    it "strokes a line at its width, with round ends" do
      canvas.stroke_line([[1, 4], [9, 4]], 2, 5)

      # The ends reach pixels 0 and 9: their centres are within 1 pixel.
      expect(rows[2..5]).to eq(%w[0000000000 5555555555 5555555555 0000000000])
    end

    it "strokes every segment of a polyline" do
      # Through pixel centres: column 2, then row 6.
      canvas.stroke_line([[2.5, 0.5], [2.5, 6.5], [8.5, 6.5]], 1, 4)

      expect(rows.map { |row| row[2] }.first(7)).to all(eq("4"))
      expect(rows[6]).to eq("0044444440")
      expect(canvas.pixels.count("\x04")).to eq(13)
    end
  end

  describe "#trace_ellipse" do
    subject(:canvas) { described_class.new(30, 30) }

    def painted
      canvas.pixels.unpack("C*").each_with_index.select { |v, _| v.positive? }.map { |_, i| i.divmod(30).reverse }
    end

    # Painted pixels as offsets from a centre pixel.
    def offsets(cx, cy) = painted.map { |x, y| [x - cx, y - cy] }.to_set

    it "draws a small circle as the midpoint algorithm does" do
      # Centre (5.4, 5.3) is in pixel (5, 5).
      canvas.trace_ellipse(5.4, 5.3, 3.2, 3.2, 0.0, 1)

      rows = canvas.pixels.unpack("C*").each_slice(30).map(&:join).map { |row| row[2..8] }
      expect(rows[2..8]).to eq(%w[0011100 0100010 1000001 1000001 1000001 0100010 0011100])
    end

    it "draws a circle symmetric around its centre pixel, inside empty" do
      canvas.trace_ellipse(15.2, 14.8, 10.0, 10.0, 0.0, 1)

      set = offsets(15, 14)
      expect(set.map { |x, y| [-x, y] }.to_set).to eq(set)
      expect(set.map { |x, y| [x, -y] }.to_set).to eq(set)
      expect(set.map { |x, y| [y, x] }.to_set).to eq(set)
      expect(set).to all(satisfy { |x, y| Math.hypot(x, y).between?(9.5, 10.5) })
    end

    it "draws an upright ellipse symmetric, turned a quarter by swapping its radii" do
      canvas.trace_ellipse(15.0, 15.0, 10.0, 3.0, Math::PI / 2, 2)

      set = offsets(15, 15)
      expect(set.map { |x, y| [-x, y] }.to_set).to eq(set)
      expect(set.map { |x, y| [x, -y] }.to_set).to eq(set)
      expect([set.map(&:first).minmax, set.map(&:last).minmax]).to eq([[-3, 3], [-10, 10]])
    end

    it "traces an ellipse at any other angle along its exact curve, 1 pixel thick" do
      canvas.trace_ellipse(15.0, 15.0, 10.0, 4.0, Math::PI / 6, 3)

      set = painted.to_set
      neighbours = ([-1, 0, 1].product([-1, 0, 1]) - [[0, 0]])
      expect(set.map { |x, y| neighbours.count { |dx, dy| set.include?([x + dx, y + dy]) } }.uniq).to eq([2])
      expect(canvas.pixels.getbyte((15 * 30) + 15)).to eq(0)
    end
  end

  describe "#paint_mask" do
    it "paints a mask's pixels" do
      pixels = [[1, 1], [2, 1], [3, 5]]
      mask = IdahImage::Export::Helpers::Mask.decode(MaskTiles.shape_args(pixels), 10, 8)

      canvas.paint_mask(mask, 7)

      expect(rows.values_at(1, 5)).to eq(%w[0770000000 0007000000])
      expect(canvas.pixels.count("\x07")).to eq(3)
    end
  end
end
