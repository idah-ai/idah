# frozen_string_literal: true

require_relative "../lib/idah_version"

RSpec.describe IdahVersion do
  around do |example|
    previous = [ENV["IDAH_VERSION"], ENV["IDAH_GIT_SHA"]]
    example.run
  ensure
    ENV["IDAH_VERSION"], ENV["IDAH_GIT_SHA"] = previous
  end

  describe ".number" do
    it "returns the version stamped into the image" do
      ENV["IDAH_VERSION"] = "0.4.0"
      expect(described_class.number).to eq("0.4.0")
    end

    it "falls back to the development version when unset" do
      ENV["IDAH_VERSION"] = nil
      expect(described_class.number).to eq("0.0.0-dev")
    end

    it "falls back to the development version when empty" do
      # A build argument that is declared but never set arrives as "".
      ENV["IDAH_VERSION"] = ""
      expect(described_class.number).to eq("0.0.0-dev")
    end
  end

  describe ".revision" do
    it "returns the commit stamped into the image" do
      ENV["IDAH_GIT_SHA"] = "1a2b3c4"
      expect(described_class.revision).to eq("1a2b3c4")
    end

    it "falls back to unknown when unset" do
      ENV["IDAH_GIT_SHA"] = nil
      expect(described_class.revision).to eq("unknown")
    end
  end

  describe ".to_h" do
    it "reports both" do
      ENV["IDAH_VERSION"] = "0.4.0"
      ENV["IDAH_GIT_SHA"] = "1a2b3c4"

      expect(described_class.to_h).to eq(
        { version: "0.4.0", revision: "1a2b3c4" }
      )
    end
  end
end
