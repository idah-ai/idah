# frozen_string_literal: true

require "zlib"

module IdahVideo
  module Export
    module Helpers
      # Writes 8-bit palette PNGs (colour type 3): one byte per pixel, the
      # index of its colour in the palette. A class mask stays readable as
      # class indexes by training code, and opens as a coloured image.
      #
      # Only Ruby's Zlib is needed: a PNG is a signature, then chunks of
      # length, type, data and CRC.
      module Png
        SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10].pack("C*")

        module_function

        # @param pixels [String] binary, width * height bytes, row by row
        # @param palette [Array<Array(Integer, Integer, Integer)>] up to 256 colours
        def write(path, width, height, pixels, palette)
          raise ArgumentError, "a palette holds at most 256 colours" if palette.size > 256

          size = width * height
          raise ArgumentError, "expected #{size} pixels, got #{pixels.bytesize}" if pixels.bytesize != size

          File.binwrite(path, encode(width, height, pixels, palette))
        end

        def encode(width, height, pixels, palette)
          header = [width, height, 8, 3, 0, 0, 0].pack("NNCCCCC")
          # Each row starts with its filter type: 0, none.
          rows = +"".b
          height.times { |y| rows << "\x00".b << pixels.byteslice(y * width, width) }

          SIGNATURE +
            chunk("IHDR", header) +
            chunk("PLTE", palette.flatten.pack("C*")) +
            chunk("IDAT", Zlib::Deflate.deflate(rows, Zlib::BEST_COMPRESSION)) +
            chunk("IEND", "".b)
        end

        def chunk(type, data)
          [data.bytesize].pack("N") + type.b + data.b + [Zlib.crc32(type + data)].pack("N")
        end
      end
    end
  end
end
