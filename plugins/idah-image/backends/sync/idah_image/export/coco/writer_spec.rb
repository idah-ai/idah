# frozen_string_literal: true

require "spec_helper"
require "json"
require "tmpdir"

RSpec.describe IdahImage::Export::Coco::Writer do
  let(:dir) { Dir.mktmpdir }
  let(:path) { File.join(dir, "annotations", "instances_default.json") }

  after { FileUtils.rm_rf(dir) }

  def written = JSON.parse(File.read(path), symbolize_names: true)

  it "writes a COCO file with sequential ids from 1" do
    writer = described_class.new(path)

    image_ids = [
      writer.add_image(file_name: "a.jpg", width: 640, height: 360),
      writer.add_image(file_name: "b.png", width: 640, height: 360)
    ]
    annotation_id = writer.add_annotation(image_id: image_ids.last, category_id: 1, bbox: [1, 2, 3, 4])
    writer.close(categories: [{ id: 1, name: "Car", supercategory: "" }])

    expect([image_ids, annotation_id]).to eq([[1, 2], 1])
    expect(written[:images].map { |i| i[:id] }).to eq([1, 2])
    expect(written[:annotations]).to eq([{ id: 1, image_id: 2, category_id: 1, bbox: [1, 2, 3, 4] }])
    expect(written[:categories]).to eq([{ id: 1, name: "Car", supercategory: "" }])
  end

  it "writes the standard COCO keys only, with info filled" do
    writer = described_class.new(path)
    writer.close(categories: [])

    expect(written.keys).to eq(%i[info licenses categories images annotations])
    expect(written[:info]).to include(description: "IDAH export", contributor: "IDAH")
    expect(written.values_at(:images, :annotations, :categories)).to eq([[], [], []])
  end

  it "is empty until an image is added" do
    writer = described_class.new(path)
    expect(writer).to be_empty

    writer.add_image(file_name: "a.jpg", width: 1, height: 1)
    expect(writer).not_to be_empty
    writer.discard
  end
end
