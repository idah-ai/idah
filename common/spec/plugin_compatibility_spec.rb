# frozen_string_literal: true

require_relative "../lib/semantic_version"
require_relative "../lib/idah_version"
require_relative "../lib/plugin_system"
require_relative "../lib/plugin_system/manifest"
require_relative "../lib/plugin_system/plugin"

RSpec.describe PluginSystem::Plugin do
  let(:logger) { double("logger") }

  around do |example|
    previous = ENV["IDAH_VERSION"]
    example.run
  ensure
    ENV["IDAH_VERSION"] = previous
  end

  before { allow(Verse).to receive(:logger).and_return(logger) }

  def plugin_requiring(idah_version)
    fields = {
      type: "idah-plugin",
      name: "idah-video",
      version: "0.1.0",
      title: "IDAH Video Annotation",
      description: "A module for annotating video.",
      entryPoints: {}
    }
    fields[:idahVersion] = idah_version if idah_version

    described_class.new("path", PluginSystem::Manifest.new(fields))
  end

  describe "the manifest field" do
    it "reads idahVersion" do
      expect(plugin_requiring("0.2.0").manifest.idah_version).to eq("0.2.0")
    end

    it "is optional" do
      expect(plugin_requiring(nil).manifest.idah_version).to be_nil
    end
  end

  describe "#warn_if_platform_too_old" do
    it "warns when the platform is older than the plugin needs" do
      ENV["IDAH_VERSION"] = "0.1.0"

      expect(logger).to receive(:warn) do |&message|
        expect(message.call).to include("needs IDAH 0.2.0 or later", "this is 0.1.0")
      end

      plugin_requiring("0.2.0").warn_if_platform_too_old
    end

    it "stays quiet when the platform is new enough" do
      ENV["IDAH_VERSION"] = "0.2.0"

      expect(logger).not_to receive(:warn)

      plugin_requiring("0.2.0").warn_if_platform_too_old
    end

    it "compares a release candidate as its release" do
      ENV["IDAH_VERSION"] = "0.2.0-rc.1"

      expect(logger).not_to receive(:warn)

      plugin_requiring("0.2.0").warn_if_platform_too_old
    end

    it "still warns when a release candidate is older than the plugin needs" do
      ENV["IDAH_VERSION"] = "0.1.0-rc.1"

      expect(logger).to receive(:warn) do |&message|
        expect(message.call).to include("needs IDAH 0.2.0 or later", "this is 0.1.0-rc.1")
      end

      plugin_requiring("0.2.0").warn_if_platform_too_old
    end

    it "stays quiet when the plugin declares no requirement" do
      ENV["IDAH_VERSION"] = "0.1.0"

      expect(logger).not_to receive(:warn)

      plugin_requiring(nil).warn_if_platform_too_old
    end

    it "stays quiet on an unstamped build, which has no version to compare" do
      ENV["IDAH_VERSION"] = nil

      expect(logger).not_to receive(:warn)

      plugin_requiring("9.9.9").warn_if_platform_too_old
    end

    it "warns instead of raising when idahVersion is not a semantic version" do
      ENV["IDAH_VERSION"] = "0.1.0"

      expect(logger).to receive(:warn) do |&message|
        expect(message.call).to include("compatibility check failed")
      end

      expect { plugin_requiring("0.2").warn_if_platform_too_old }.not_to raise_error
    end

    # A version-check bug once took a whole service down at boot, so the check
    # swallows anything it raises.
    it "warns instead of raising when the comparison itself breaks" do
      ENV["IDAH_VERSION"] = "0.1.0"
      allow(SemanticVersion).to receive(:[]).and_raise(NoMethodError, "boom")

      expect(logger).to receive(:warn) do |&message|
        expect(message.call).to include("compatibility check failed")
      end

      expect { plugin_requiring("0.2.0").warn_if_platform_too_old }.not_to raise_error
    end
  end
end
