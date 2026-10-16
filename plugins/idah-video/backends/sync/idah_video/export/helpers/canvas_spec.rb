# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::Export::Helpers::Canvas do
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
end
