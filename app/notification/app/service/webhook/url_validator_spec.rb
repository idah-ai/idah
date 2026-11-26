# frozen_string_literal: true

require "spec_helper"

RSpec.describe Webhook::UrlValidator do
  def valid?(url)
    described_class.validate!(url)
    true
  rescue Verse::Error::ValidationFailed
    false
  end

  it "accepts public http(s) URLs" do
    expect(valid?("https://93.184.216.34/hook")).to be true
    expect(valid?("http://93.184.216.34:8080/hook")).to be true
  end

  it "rejects non-http URLs" do
    expect(valid?("ftp://93.184.216.34/")).to be false
    expect(valid?("not a url")).to be false
    expect(valid?(nil)).to be false
  end

  it "rejects loopback, link-local, unspecified and private addresses" do
    %w[
      http://127.0.0.1/ http://[::1]/
      http://169.254.169.254/ http://[fe80::1]/
      http://0.0.0.0/ http://[::]/
      http://10.0.0.5/ http://172.16.0.1/ http://192.168.1.1/ http://[fd00::1]/
      http://[::ffff:10.0.0.1]/
    ].each do |url|
      expect(valid?(url)).to be(false), url
    end
  end

  it "checks every address a hostname resolves to" do
    allow(Resolv).to receive(:getaddresses).with("hooks.example.com").and_return(["93.184.216.34", "10.0.0.5"])

    expect(valid?("https://hooks.example.com/")).to be false
  end

  it "rejects hosts that don't resolve" do
    allow(Resolv).to receive(:getaddresses).with("nowhere.invalid").and_return([])

    expect(valid?("https://nowhere.invalid/")).to be false
  end
end
