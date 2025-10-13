# frozen_string_literal: true

require "spec_helper"

RSpec.describe NoteFeedsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:uuid) { "3f8b9c0-4d2e-11ec-bf63-0242ac130002" }
  let(:uuid2) { "5f8b9c0-4d2e-11ec-bf63-1300020242ac" }
  let(:entry_id) { "6f8b9c0-4d2e-11ec-bf63-0242ac130003" }

  let(:note_feed_record) do
    NoteFeed::Record.new(
      {
        id: uuid,
        entry_id: entry_id,
        anchor_type: "entry",
        position: { "x" => 100, "y" => 200 },
        content_md: "This is a test note",
        status: "pending",
        created_by_id: 1,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:note_feed_data) do
    {
      data: {
        type: Resource::Dataset::NoteFeeds,
        id: uuid,
        attributes: {
          anchor_type: "entry",
          position: { "x" => 100, "y" => 200 },
          content_md: "This is a test note",
          entry_id: entry_id
        }
      }
    }
  end

  let(:service) { instance_double(NoteFeed::Service) }

  before do
    allow(NoteFeed::Service).to receive(:new).and_return(service)
  end

  it "index" do
    expect(service).to receive(:index).and_return([note_feed_record])
    get "/note_feeds"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record[0].id).to eq uuid
    expect(record[0].anchor_type).to eq "entry"
  end

  it "show" do
    expect(service).to receive(:show).with(uuid, included: []).and_return(note_feed_record)
    get "/note_feeds/#{uuid}"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq uuid
    expect(record.content_md).to eq "This is a test note"
  end

  it "create" do
    expect(service).to receive(:create_from_params) do |args|
      expect(args[:anchor_type]).to eq "entry"
      expect(args[:position]).to eq({ x: 100, y: 200 })
      expect(args[:content_md]).to eq "This is a test note"
      note_feed_record
    end
    post "/note_feeds", note_feed_data

    expect(last_response.status).to eq 201
  end

  it "update" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq uuid
      expect(args.attributes[:content_md]).to eq "This is a test note"
      note_feed_record
    end

    patch "/note_feeds/#{uuid}", note_feed_data
    expect(last_response.status).to eq 200
  end

  it "destroy" do
    expect(service).to receive(:delete).with(uuid).and_return(true)
    delete "/note_feeds/#{uuid}"

    expect(last_response.status).to eq 204
  end

  describe "resolve" do
    it "resolves a note feed" do
      expect(service).to receive(:resolve).with(uuid).and_return(note_feed_record)
      post "/note_feeds/#{uuid}/resolve"

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      record = deserialize(body)
      expect(record.id).to eq uuid
    end
  end
end
