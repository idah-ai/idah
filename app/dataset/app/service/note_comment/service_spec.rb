# frozen_string_literal: true

require "spec_helper"

RSpec.describe NoteComment::Service, database: true do
  before do
    # freeze the time
    allow(Time).to receive(:now).and_return(
      Time.utc(2025, 1, 1, 0, 0, 0)
    )
  end
  let(:auth_context) { Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:repo) { NoteComment::Repository.new(auth_context) }
  let(:note_feed_repo) { NoteFeed::Repository.new(auth_context) }
  let(:entry_repo) { Entry::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }
  let(:project_repo) { Project::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(
      name: "Test Project",
      description: "A test project",
      created_by_email: "user@example.com",
      organization_id: 1,
    )
  end

  let!(:dataset_id) do
    dataset_repo.create(
      modality: "video",
      labels: ["cat", "dog"],
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: {},
      project_id:
    )
  end

  let!(:entry_id) do
    entry_repo.create(
      priority: 1,
      resource: "http://example.com/video.mp4",
      wf_step: "start",
      status: "pending",
      assigned_to_id: 1,
      project_id:,
      dataset_id:
    )
  end

  let!(:note_feed_id) do
    note_feed_repo.create(
      project_id:,
      dataset_id:,
      entry_id:,
      anchor_type: "entry",
      position: { "x" => 100, "y" => 200 },
      content_md: "This is a test note feed",
      status: "pending",
      created_by_email: "reviewer@example.com"
    )
  end

  let(:note_comment_attributes) do
    {
      content_md: "This is a test comment",
      created_by_email: "user@example.com"
    }
  end

  let(:note_comment) do
    record = deserialize(
      {
        data: {
          type: "dataset:note_comments",
          attributes: note_comment_attributes,
          relationships: {
            note_feed: {
              data: {
                type: "dataset:note_feeds",
                id: note_feed_id
              }
            }
          }
        }
      }
    )
    subject.create(record)
  end

  describe "#create" do
    context "when note_feed is provided" do
      it "creates a note comment with is_edited false" do
        record = deserialize(
          {
            data: {
              type: "dataset:note_comments",
              attributes: note_comment_attributes,
              relationships: {
                note_feed: {
                  data: {
                    type: "dataset:note_feeds",
                    id: note_feed_id
                  }
                }
              }
            }
          }
        )

        result = subject.create(record)

        expect(result.note_feed_id).to eq(note_feed_id)
        expect(result.content_md).to eq("This is a test comment")
        expect(result.edited_at).to be_nil
        expect(result.created_by_email).to eq("user@example.com")
      end
    end

    context "when note_feed is not provided" do
      it "raises a validation error" do
        record = deserialize(
          {
            data: {
              type: "dataset:note_comments",
              attributes: note_comment_attributes
            }
          }
        )

        expect { subject.create(record) }
          .to raise_error(Verse::Error::ValidationFailed, "note_feed is required to create a note comment")
      end
    end

    context "when id is provided" do
      let(:custom_id) { UUIDv7.generate }

      it "creates a note comment with the provided id" do
        record = deserialize(
          {
            data: {
              type: "dataset:note_comments",
              id: custom_id,
              attributes: note_comment_attributes,
              relationships: {
                note_feed: {
                  data: {
                    type: "dataset:note_feeds",
                    id: note_feed_id
                  }
                }
              }
            }
          }
        )

        result = subject.create(record)

        expect(result.id).to eq(custom_id)
      end
    end
  end

  describe "#index" do
    before do
      # Create first note comment
      note_comment

      # Create second note comment
      record = deserialize(
        {
          data: {
            type: "dataset:note_comments",
            attributes: note_comment_attributes.merge(content_md: "Another comment"),
            relationships: {
              note_feed: {
                data: {
                  type: "dataset:note_feeds",
                  id: note_feed_id
                }
              }
            }
          }
        }
      )
      subject.create(record)
    end

    it "returns all note comments when no filter is provided" do
      result = subject.index

      expect(result.count).to eq(2)
    end

    it "filters note comments by note_feed_id" do
      result = subject.index({ note_feed_id: note_feed_id })
      expect(result.all? { |nc| nc.note_feed_id == note_feed_id }).to be true
    end

    it "supports pagination" do
      result = subject.index({}, page: 1, items_per_page: 1)
      expect(result.count).to eq(1)
    end
  end

  describe "#show" do
    it "shows a note comment" do
      found_note_comment = subject.show(note_comment.id)
      expect(found_note_comment.id).to eq(note_comment.id)
      expect(found_note_comment.content_md).to eq("This is a test comment")
    end

    it "raises error when note comment not found" do
      expect { subject.show(UUIDv7.generate) }.to raise_error(Verse::Error::NotFound)
    end

    it "includes relationships when specified" do
      result = subject.show(note_comment.id, included: ["note_feed"])
      expect(result.note_feed).not_to be_nil
      expect(result.note_feed.id).to eq(note_feed_id)
    end
  end

  describe "#update" do
    it "updates a note comment and sets is_edited to true" do
      record = deserialize(
        {
          data: {
            type: "dataset:note_comments",
            id: note_comment.id,
            attributes: {
              content_md: "Updated comment content"
            }
          }
        }
      )

      result = subject.update(record)

      expect(result.content_md).to eq("Updated comment content")
      expect(result.edited_at).to eq(Time.now)
      expect(result.id).to eq(note_comment.id)
    end
  end

  describe "#delete" do
    it "deletes a note comment" do
      subject.delete(note_comment.id)
      expect { repo.find!(note_comment.id) }.to raise_error(Verse::Error::NotFound)
    end
  end
end
