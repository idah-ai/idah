# frozen_string_literal: true

require_relative "../../spec_helper"
require "zip"

RSpec.describe Exports::IoContext do
  let(:io_context) { described_class.new }

  after do
    io_context.cleanup
  end

  describe "#file" do
    it "creates a temp file" do
      file = io_context.file
      expect(file).to be_a(File)
    end

    it "raises an error if mode is already set to directory" do
      io_context.directory
      expect { io_context.file }.to raise_error("IoContext is already initialized with dir mode")
    end
  end

  describe "#directory" do
    it "creates a temp directory" do
      dir = io_context.directory
      expect(Dir.exist?(dir)).to be true
    end

    it "raises an error if mode is already set to file" do
      io_context.file
      expect { io_context.directory }.to raise_error("IoContext is already initialized with file mode")
    end
  end

  describe "#zip_directory" do
    it "zips the directory contents" do
      dir = io_context.directory
      File.write("#{dir}/test.txt", "hello")
      zip_path = io_context.zip_directory
      expect(File.exist?(zip_path)).to be true

      Zip::File.open(zip_path) do |zip_file|
        expect(zip_file.find_entry("test.txt")).not_to be_nil
        expect(zip_file.read("test.txt")).to eq("hello")
      end
    end

    it "raises an error if not in directory mode" do
      expect { io_context.zip_directory }.to raise_error("Not in directory mode")
    end
  end
end
