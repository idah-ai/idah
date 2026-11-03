# frozen_string_literal: true

require "spec_helper"
require "json"
require "tmpdir"

RSpec.describe IdahVideo::Export::Helpers::Report do
  it "opens with the format, the export time and the options, then the counts" do
    report = described_class.new(format: "COCO", options: { include_medias: "none", boxes: "polygon" })
    report.count(:images, 3)
    report.skip(:deleted)

    Dir.mktmpdir do |dir|
      path = File.join(dir, "export_report.json")
      report.write(path)
      written = JSON.parse(File.read(path), symbolize_names: true)

      expect(written.keys.first(3)).to eq(%i[format exported_at options])
      expect(written).to include(format: "COCO", options: { include_medias: "none", boxes: "polygon" }, images: 3)
      expect(Time.iso8601(written[:exported_at])).to be_within(60).of(Time.now)
      expect(written[:skipped]).to eq({ deleted: 1 })
    end
  end
end
