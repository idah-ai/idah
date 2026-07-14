# frozen_string_literal: true

require "spec_helper"

RSpec.describe PluginMimeType do
  describe ".for" do
    it "maps known extensions to their content type" do
      expect(described_class.for("plugin.js")).to eq("text/javascript")
      expect(described_class.for("plugin.css")).to eq("text/css")
      expect(described_class.for("config.json")).to eq("application/json")
      expect(described_class.for("icon.svg")).to eq("image/svg+xml")
      expect(described_class.for("logo.png")).to eq("image/png")
      expect(described_class.for("font.woff2")).to eq("font/woff2")
    end

    it "is case-insensitive on the extension" do
      expect(described_class.for("LOGO.PNG")).to eq("image/png")
    end

    it "falls back to octet-stream for unknown extensions" do
      expect(described_class.for("archive.zip")).to eq("application/octet-stream")
    end

    it "falls back to octet-stream when there is no extension" do
      expect(described_class.for("README")).to eq("application/octet-stream")
    end

    it "handles nil safely" do
      expect(described_class.for(nil)).to eq("application/octet-stream")
    end
  end
end
