# frozen_string_literal: true

require "spec_helper"
require "tmpdir"
require "zlib"

RSpec.describe IdahVideo::Export::Helpers::Png do
  # Splits a PNG into its chunks, checking each CRC.
  def chunks(bytes)
    expect(bytes.byteslice(0, 8)).to eq(described_class::SIGNATURE)
    offset = 8
    found = []
    while offset < bytes.bytesize
      length = bytes.byteslice(offset, 4).unpack1("N")
      type = bytes.byteslice(offset + 4, 4)
      data = bytes.byteslice(offset + 8, length)
      expect(bytes.byteslice(offset + 8 + length, 4).unpack1("N")).to eq(Zlib.crc32(type + data))
      found << [type, data]
      offset += 12 + length
    end
    found
  end

  it "writes an 8-bit palette PNG, a filter byte and the indexes on each row" do
    pixels = [0, 1, 2, 1, 1, 0].pack("C*") # 3 x 2
    palette = [[0, 0, 0], [255, 0, 0], [0, 128, 255]]

    types, data = chunks(described_class.encode(3, 2, pixels, palette)).transpose

    expect(types).to eq(%w[IHDR PLTE IDAT IEND])
    expect(data[0].unpack("NNCCCCC")).to eq([3, 2, 8, 3, 0, 0, 0])
    expect(data[1].unpack("C*")).to eq(palette.flatten)
    expect(Zlib::Inflate.inflate(data[2]).unpack("C*")).to eq([0, 0, 1, 2, 0, 1, 1, 0])
  end

  it "writes the file" do
    Dir.mktmpdir do |dir|
      path = File.join(dir, "mask.png")
      described_class.write(path, 1, 1, "\x01".b, [[0, 0, 0], [1, 2, 3]])

      expect(File.binread(path)).to eq(described_class.encode(1, 1, "\x01".b, [[0, 0, 0], [1, 2, 3]]))
    end
  end

  it "refuses pixels that do not fill the image, and more than 256 colours" do
    expect { described_class.write("x.png", 2, 2, "\x00".b, [[0, 0, 0]]) }.to raise_error(ArgumentError, /4 pixels/)
    expect { described_class.write("x.png", 1, 1, "\x00".b, [[0, 0, 0]] * 257) }.to raise_error(ArgumentError, /256/)
  end
end
