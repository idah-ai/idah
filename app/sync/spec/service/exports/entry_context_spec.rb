# frozen_string_literal: true

require "spec_helper"
require_relative "../../../app/service/exports/entry_context"
require_relative "../../../app/service/exports/annotation_context"
require_relative "../../../app/service/exports/media_context"

# Register the endpoints for the spec
Api[:idah].register(
  :dataset, :annotations, :index_all
) do |params = {}|
  Api.all(params) do |p|
    output = get(
      "dataset/annotations",
      params: p,
      options: { auth: :bearer }
    )
    deserialize(output.body)
  end
end

Api[:idah].register(
  :media, :medias, :index_all
) do |params = {}|
  Api.all(params) do |p|
    output = get(
      "media/medias",
      params: p,
      options: { auth: :bearer }
    )
    deserialize(output.body)
  end
end

RSpec.describe Exports::EntryContext do
  let(:entry_id) { "019bc0fa-025e-7a8c-a3f4-82b276508315" }
  let(:entry_resource) { "4c2052a1475842e9.mov" }
  let(:entry) do
    double(
      "Entry",
      id: entry_id,
      resource: entry_resource
    )
  end
  let(:annotations_json) { File.read("app/spec_data/api_data/annotations.json") }
  let(:medias_json) { File.read("app/spec_data/api_data/medias.json") }

  subject { described_class.new(entry) }

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

  describe "#entry" do
    it "returns the entry object" do
      expect(subject.entry).to eq(entry)
    end
  end

  describe "#annotations" do
    it "returns an array of AnnotationContext objects" do
      stub_request(
        :get,
        "http://idah.test/dataset/annotations?filter%5Bentry_id%5D=#{entry_id}&included%5B%5D=project_members&page%5Bnumber%5D=1&page%5Bsize%5D=1000"
      ).
        to_return(
          status: 200,
          body: annotations_json,
          headers: { 'Content-Type': "application/json" }
        )

      annotations = subject.annotations
      expect(annotations).to be_an(Array)
      expect(annotations.size).to eq(1)
      expect(annotations.first).to be_a(Exports::AnnotationContext)
      expect(annotations.first.annotation.id).to eq("019b2aec-94ff-7b50-bb44-8a3675e266f3")
    end
  end

  describe "#medias" do
    it "returns an array of MediaContext objects" do
      stub_request(
        :get,
        "http://idah.test/media/medias?filter%5Bresource%5D=#{entry_resource}&page%5Bnumber%5D=1&page%5Bsize%5D=1000"
      ).
        to_return(
          status: 200,
          body: medias_json,
          headers: { 'Content-Type': "application/json" }
        )

      medias = subject.medias
      expect(medias).to be_an(Array)
      expect(medias.size).to eq(11)
      expect(medias.first).to be_a(Exports::MediaContext)
      expect(medias.first.media.id).to eq("004f2b1c21bf42e0efe8b709a688afce.mov")
    end
  end
end
