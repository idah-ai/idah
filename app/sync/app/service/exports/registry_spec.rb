# frozen_string_literal: true

RSpec.describe Exports::Registry do
  subject { described_class }

  before do
    # Reset registry state before each test to ensure isolation
    subject.instance_variable_set(:@registry, {})
  end

  # Dummy classes for testing
  # rubocop:disable Lint/ConstantDefinitionInBlock
  class self::TestExportFormatA; end
  class self::TestExportFormatB; end
  class self::TestExportFormatC; end
  # rubocop:enable Lint/ConstantDefinitionInBlock

  let(:format_a) { self.class::TestExportFormatA }
  let(:format_b) { self.class::TestExportFormatB }
  let(:format_c) { self.class::TestExportFormatC }

  describe ".register" do
    it "registers a class for a single string modality" do
      subject.register("image", format_a)
      expect(subject.list_export_format(["image"])).to include(format_a)
    end

    it "registers a class for a single regexp modality" do
      subject.register(/video.*/, format_b)
      expect(subject.list_export_format(["video/mp4"])).to include(format_b)
    end

    it "registers a class for multiple modalities (array)" do
      subject.register(["audio", /text.*/], format_c)
      expect(subject.list_export_format(["audio"])).to include(format_c)
      expect(subject.list_export_format(["text/plain"])).to include(format_c)
    end

    it "raises ArgumentError if modality is not String, Regexp or Array" do
      expect {
        subject.register(123, format_a)
      }.to raise_error(ArgumentError, /modality selector must be String or Regexp/)
    end

    it "raises ArgumentError if any modality in array is invalid" do
      expect {
        subject.register(["valid", 123], format_a)
      }.to raise_error(ArgumentError, /modality selector must be String or Regexp/)
    end
  end

  describe ".valid_export_class?" do
    before do
      subject.register("image", format_a)
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

  describe ".list_export_format" do
    before do
      subject.register("common", format_a)
      subject.register(/special.*/, format_b)
      subject.register("common", format_c) # Multiple formats for same modality
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
      subject.register("duplicate", format_a)

      formats = subject.list_export_format(["common", "duplicate"])
      expect(formats).to include(format_a)
      expect(formats.select { |f| f == format_a }.size).to eq(1)
    end

    it "returns empty set if no matches found" do
      expect(subject.list_export_format(["unknown"])).to be_empty
    end
  end
end
