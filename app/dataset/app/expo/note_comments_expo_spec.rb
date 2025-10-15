# frozen_string_literal: true

require "spec_helper"

RSpec.describe NoteCommentsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:uuid) { "3f8b9c0-4d2e-11ec-bf63-0242ac130002" }
  let(:uuid2) { "5f8b9c0-4d2e-11ec-bf63-1300020242ac" }
  let(:note_feed_id) { "6f8b9c0-4d2e-11ec-bf63-0242ac130003" }

  let(:note_comment_record) do
    NoteComment::Record.new(
      {
        id: uuid,
        note_feed_id: note_feed_id,
        content_md: "This is a test comment",
        is_edited: false,
        created_by_email: nil,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:note_comment_data) do
    {
      data: {
        type: Resource::Dataset::NoteComments,
        id: uuid,
        attributes: {
          content_md: "This is a test comment"
        },
        relationships: {
          note_feed: {
            data: {
              type: Resource::Dataset::NoteFeeds,
              id: note_feed_id
            }
          }
        }
      }
    }
  end

  let(:service) { instance_double(NoteComment::Service) }

  before do
    allow(NoteComment::Service).to receive(:new).and_return(service)
  end

  it "index" do
    expect(service).to receive(:index).and_return([note_comment_record])
    get "/note_comments"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record[0].id).to eq uuid
    expect(record[0].content_md).to eq "This is a test comment"
  end

  it "show" do
    expect(service).to receive(:show).with(uuid, included: []).and_return(note_comment_record)
    get "/note_comments/#{uuid}"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq uuid
    expect(record.content_md).to eq "This is a test comment"
    expect(record.is_edited).to eq false
  end

  it "create" do
    expect(service).to receive(:create).and_return(note_comment_record)
    post "/note_comments", note_comment_data

    expect(last_response.status).to eq 201
  end

  it "update" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq uuid
      expect(args.attributes[:content_md]).to eq "This is a test comment"
      note_comment_record
    end

    patch "/note_comments/#{uuid}", note_comment_data
    expect(last_response.status).to eq 200
  end

  it "destroy" do
    expect(service).to receive(:delete).with(uuid).and_return(true)
    delete "/note_comments/#{uuid}"

    expect(last_response.status).to eq 204
  end
end
