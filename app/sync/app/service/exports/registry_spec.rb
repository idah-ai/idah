# frozen_string_literal: true

RSpec.describe Exports::Registry do
  subject { described_class }

  before do
    # Reset registry state before each test to ensure isolation
    subject.instance_variable_set(:@registry, {})
  end

  # Dummy classes for testing
  # rubocop:disable Lint/ConstantDefinitionInBlock
  class TestExportFormatA
    def name
      "Format A"
    end

    def description
      "Description for Format A"
    end
  end

  class TestExportFormatB
    def name
      "Format B"
    end

    def description
      "Description for Format B"
    end
  end

  class TestExportFormatC
    def name
      "Format C"
    end

    def description
      "Description for Format C"
    end
  end
  # rubocop:enable Lint/ConstantDefinitionInBlock

  let(:format_a) { TestExportFormatA }
  let(:format_b) { TestExportFormatB }
  let(:format_c) { TestExportFormatC }

  describe "#register" do
    it "registers a class for a single string modality" do
      subject.register("image-plugin", "image", format_a)
      expect(subject.list_export_format(["image"])).to include(format_a)
    end

    it "registers a class for a single regexp modality" do
      subject.register("video-plugin", /video.*/, format_b)
      expect(subject.list_export_format(["video/mp4"])).to include(format_b)
    end

    it "registers a class for multiple modalities (array)" do
      subject.register("audio-plugin", ["audio", /text.*/], format_c)
      expect(subject.list_export_format(["audio"])).to include(format_c)
      expect(subject.list_export_format(["text/plain"])).to include(format_c)
    end

    it "raises ArgumentError if modality is not String, Regexp or Array" do
      expect {
        subject.register("invalid-plugin", 123, format_a)
      }.to raise_error(ArgumentError, /modality selector must be String or Regexp/)
    end

    it "raises ArgumentError if any modality in array is invalid" do
      expect {
        subject.register("invalid-plugin", ["valid", 123], format_a)
      }.to raise_error(ArgumentError, /modality selector must be String or Regexp/)
    end
  end

  describe "#valid_export_class?" do
    before do
      subject.register("image-plugin", "image", format_a)
    end

    it "returns true if the class name (String) is registered" do
      expect(subject.valid_export_class?(format_a.to_s)).to be true
    end

    it "returns false if the class name (String) is not registered" do
      expect(subject.valid_export_class?("NonExistentClass")).to be false
    end

    it "returns false if passed the Class object itself (due to implementation check)" do
      # Based on current implementation: v.map(&:to_s).include?(klass)
      # If klass is the Class object, it won't be found in the array of strings.
      expect(subject.valid_export_class?(format_a)).to be false
    end
  end

  describe "#list_export_format" do
    before do
      subject.register("common-plugin", "common", format_a)
      subject.register("special-plugin", /special.*/, format_b)
      subject.register("common-plugin", "common", format_c) # Multiple formats for same modality
    end

    it "returns all formats matching a string modality" do
      formats = subject.list_export_format(["common"])
      expect(formats).to include(format_a, format_c)
      expect(formats).not_to include(format_b)
    end

    it "returns formats matching a regex modality" do
      formats = subject.list_export_format(["special_case"])
      expect(formats).to include(format_b)
      expect(formats).not_to include(format_a, format_c)
    end

    it "returns formats for multiple requested modalities" do
      formats = subject.list_export_format(["common", "special_preview"])
      expect(formats).to include(format_a, format_b, format_c)
    end

    it "returns unique list of formats" do
      # format_a matches "common"
      # Let's register format_a for another matching key
      subject.register("duplicate-plugin", "duplicate", format_a)

      formats = subject.list_export_format(["common", "duplicate"])
      expect(formats).to include(format_a)
      expect(formats.select { |f| f == format_a }.size).to eq(1)
    end

    it "returns empty set if no matches found" do
      expect(subject.list_export_format(["unknown"])).to be_empty
    end
  end

  describe "#list_export_format_details" do
    before do
      subject.register("detailed-plugin", "detailed", format_a)
    end

    it "returns detailed information for each export format" do
      details = subject.list_export_format_details(["detailed"])
      expect(details).to be_an(Array)
      expect(details.size).to eq(1)

      detail = details.first
      expect(detail[:name]).to eq("Format A")
      expect(detail[:description]).to eq("Description for Format A")
      expect(detail[:exporter]).to eq(format_a.to_s)
    end

    it "returns empty array if no formats match" do
      details = subject.list_export_format_details(["nonexistent"])
      expect(details).to be_empty
    end
  end

  describe "#clear" do
    before do
      described_class.register(
        "plugin1",
        "image",
        format_a
      )
      described_class.register(
        "plugin2",
        "video",
        format_b
      )
    end

    it "clears only the processors of a specific plugin" do
      described_class.clear("plugin1")
      expect(described_class.list_export_format(["image"])).to be_empty
      expect(described_class.list_export_format(["video"])).to include(format_b)
    end
  end

  it "#clear_all" do
    described_class.register(
      "plugin1",
      "image",
      format_a
    )
    described_class.register(
      "plugin2",
      "video",
      format_b
    )

    described_class.clear_all
    expect(described_class.list_export_format(["image"])).to be_empty
    expect(described_class.list_export_format(["video"])).to be_empty
  end
end
