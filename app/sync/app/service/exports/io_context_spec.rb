# frozen_string_literal: true

require_relative "../../spec_helper"
require "zip"

RSpec.describe Exports::IoContext do
  let(:io_context) { described_class.new }

  after do
    io_context.cleanup
  end

  describe "#file=" do
    it "sets the file" do
      test_file = Tempfile.new("test")
      io_context.file = test_file
      expect(io_context.instance_variable_get(:@file)).to eq(test_file)
    end

    it "sets the mode to :file" do
      test_file = Tempfile.new("test")
      io_context.file = test_file
      expect(io_context.mode).to eq(:file)
    end

    it "raises an error if mode is already set to directory" do
      test_file = Tempfile.new("test")
      io_context.directory
      expect { io_context.file = test_file }.to raise_error("IoContext is already initialized with dir mode")
      test_file.close
      test_file.unlink
    end

    it "allows setting file when mode is already :file" do
      first_file = Tempfile.new("first")
      second_file = Tempfile.new("second")

      io_context.file = first_file
      expect { io_context.file = second_file }.not_to raise_error
      expect(io_context.instance_variable_get(:@file)).to eq(second_file)
    end

    it "cleans up existing file when setting a new file" do
      first_file = Tempfile.new("first")
      first_file_path = first_file.path

      io_context.file = first_file
      second_file = Tempfile.new("second")
      io_context.file = second_file

      expect(File.exist?(first_file_path)).to be false
    end
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
      zip_file_obj = io_context.zip_directory
      expect(File.exist?(zip_file_obj.path)).to be true

      Zip::File.open(zip_file_obj.path) do |zip_file|
        expect(zip_file.find_entry("test.txt")).not_to be_nil
        expect(zip_file.read("test.txt")).to eq("hello")
      end
    end

    it "raises an error if not in directory mode" do
      expect { io_context.zip_directory }.to raise_error("Not in directory mode")
    end
  end
end
