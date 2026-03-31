# frozen_string_literal: true

require "spec_helper"
require_relative "../../../app/service/exports/media_context"

# Register the endpoint for the spec
Api[:idah].register(
  :media, :medias, :files
) do |params = {}|
  output = get(
    "media/medias/files",
    params:,
    options: { auth: :bearer }
  )
  output.body
end

RSpec.describe Exports::MediaContext do
  let(:media_id) { "004f2b1c21bf42e0efe8b709a688afce.mov" }
  let(:media_resource) { "46dfaeda36d34c0d.mov" }
  let(:media_key) { "" }
  let(:media) do
    double(
      "Media",
      id: media_id,
      resource: media_resource,
      key: media_key,
      filename: "dc160a222abc4a6e.mov",
      mime_type: "video/quicktime",
      size: 13_675_223
    )
  end

  subject { described_class.new(media) }

  before do
    Api[:idah].base_url = "http://idah.test"

    # Mock the login request to get a token
    stub_request(:post, "http://idah.test/iam/auth/login").
      with(
        body: { "email" => "sync@services.idah.ai", "password" => "password" }
      ).
      to_return(
        status: 200,
        body: JSON.generate(
          data: {},
          meta: {
            token: "test.eyJleHAiOjE3ODA3MzMyODB9.test"
          }
        ),
        headers: { 'Content-Type': "application/json" }
      )
  end

  describe "#media" do
    it "returns the media object" do
      expect(subject.media).to eq(media)
    end

    it "provides access to media id" do
      expect(subject.media.id).to eq(media_id)
    end

    it "provides access to media resource" do
      expect(subject.media.resource).to eq(media_resource)
    end

    it "provides access to media key" do
      expect(subject.media.key).to eq(media_key)
    end

    it "provides access to media filename" do
      expect(subject.media.filename).to eq("dc160a222abc4a6e.mov")
    end

    it "provides access to media mime_type" do
      expect(subject.media.mime_type).to eq("video/quicktime")
    end
  end

  describe "#download" do
    let(:binary_data) { "fake binary video data" }

    it "downloads media file content" do
      stub_request(
        :get,
        "http://idah.test/media/medias/files?key=&resource=#{media_resource}"
      ).
        to_return(
          status: 200,
          body: binary_data,
          headers: { 'Content-Type': "video/quicktime" }
        )

      result = subject.download
      expect(result).to eq(binary_data)
    end

    context "with non-empty key" do
      let(:media_key) { "240p.m3u8" }

      it "downloads media file with key parameter" do
        stub_request(
          :get,
          "http://idah.test/media/medias/files?key=240p.m3u8&resource=#{media_resource}"
        ).
          to_return(
            status: 200,
            body: binary_data,
            headers: { 'Content-Type': "application/vnd.apple.mpegurl" }
          )

        result = subject.download
        expect(result).to eq(binary_data)
      end
    end
  end
end
