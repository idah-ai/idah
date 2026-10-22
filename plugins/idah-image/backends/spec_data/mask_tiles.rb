# frozen_string_literal: true

# Builds mask `shape_args` the way the frontend stores them
# (frontend/src/lib/mask/rle.ts and flush-tiles.ts): 128 x 128 tiles keyed
# `tile-<col>x<row>`, each a run-length encoding of its pixels in row order,
# starting with a run of 0s, the last run left out, each run as 1 byte (below
# 128) or 2 bytes, base64 encoded.
module MaskTiles
  extend self

  SIZE = 128

  # @param pixels [Enumerable<Array(Integer, Integer)>] [x, y] pixels set to 1
  def shape_args(pixels)
    tiles = Hash.new { |hash, key| hash[key] = Array.new(SIZE * SIZE, 0) }
    pixels.each { |x, y| tiles[[x / SIZE, y / SIZE]][((y % SIZE) * SIZE) + (x % SIZE)] = 1 }

    tiles.to_h { |(col, row), buffer| [:"tile-#{col}x#{row}", { rle: encode(buffer) }] }
  end

  def encode(buffer)
    runs = []
    bit = 0
    count = 0
    buffer.each do |value|
      if value == bit
        count += 1
      else
        runs << count
        bit = 1 - bit
        count = 1
      end
    end
    # The last run is implied by the tile size.
    return "" if runs.empty?

    bytes = runs.flat_map { |run| run < 128 ? [run] : [0x80 | (run >> 8), run & 0xff] }
    [bytes.pack("C*")].pack("m0")
  end
end
