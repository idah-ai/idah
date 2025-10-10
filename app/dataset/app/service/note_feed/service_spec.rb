# frozen_string_literal: true

require "spec_helper"

RSpec.describe NoteFeed::Service, database: true do
  let(:auth_context) { Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:repo) { NoteFeed::Repository.new(auth_context) }
  let(:entry_repo) { Entry::Repository.new(auth_context) }
  let(:annotation_repo) { Annotation::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }
  let(:project_repo) { Project::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(name: "Test Project", description: "A test project", created_by_id: 1)
  end

  let!(:dataset_id) do
    dataset_repo.create(
      modality: "video",
      labels: ["cat", "dog"],
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: {},
      project_id: project_id
    )
  end

  let!(:entry_id) do
    entry_repo.create(
      priority: 1,
      resource: "http://example.com/video.mp4",
      wf_step: "start",
      status: "pending",
      assigned_to_id: 1,
      dataset_id: dataset_id
    )
  end

  let!(:annotation_id) do
    annotation_repo.create(
      entry_id: entry_id,
      dimensions: { "x" => 10, "y" => 20, "width" => 100, "height" => 50 },
      annotation: { "label" => "cat" },
      created_by_id: 1
    )
  end

  let(:note_feed_attributes) do
    {
      anchor_type: "entry",
      position: { "x" => 100, "y" => 200 },
      content_md: "This is a test note"
    }
  end

  let(:note_feed) do
    record = deserialize(
      {
        data: {
          type: "dataset:note_feeds",
          attributes: note_feed_attributes,
          relationships: {
            entry: {
              data: {
                type: "dataset:entries",
                id: entry_id
              }
            }
          }
        }
      }
    )
    subject.create(record)
  end

  describe "#create" do
    context "when entry is provided" do
      it "creates a note feed with status pending" do
        record = deserialize(
          {
            data: {
              type: "dataset:note_feeds",
              attributes: note_feed_attributes,
              relationships: {
                entry: {
                  data: {
                    type: "dataset:entries",
                    id: entry_id
                  }
                }
              }
            }
          }
        )

        result = subject.create(record)

        expect(result.entry_id).to eq(entry_id)
        expect(result.anchor_type).to eq("entry")
        expect(result.content_md).to eq("This is a test note")
        expect(result.position).to eq({ x: 100, y: 200 })
        expect(result.status).to eq("pending")
        expect(result.created_by_id).to eq(1)
      end
    end

    context "when annotation is provided with anchor_type annotation" do
      it "creates a note feed linked to annotation" do
        record = deserialize(
          {
            data: {
              type: "dataset:note_feeds",
              attributes: note_feed_attributes.merge(anchor_type: "annotation"),
              relationships: {
                entry: {
                  data: {
                    type: "dataset:entries",
                    id: entry_id
                  }
                },
                annotation: {
                  data: {
                    type: "dataset:annotations",
                    id: annotation_id
                  }
                }
              }
            }
          }
        )

        result = subject.create(record)

        expect(result.entry_id).to eq(entry_id)
        expect(result.annotation_id).to eq(annotation_id)
        expect(result.anchor_type).to eq("annotation")
      end
    end

    context "when entry is not provided" do
      it "raises a validation error" do
        record = deserialize(
          {
            data: {
              type: "dataset:note_feeds",
              attributes: note_feed_attributes
            }
          }
        )

        expect { subject.create(record) }
          .to raise_error(Verse::Error::ValidationFailed, "entry is required to create a note feed")
      end
    end

    context "when id is provided" do
      let(:custom_id) { UUIDv7.generate }

      it "creates a note feed with the provided id" do
        record = deserialize(
          {
            data: {
              type: "dataset:note_feeds",
              id: custom_id,
              attributes: note_feed_attributes,
              relationships: {
                entry: {
                  data: {
                    type: "dataset:entries",
                    id: entry_id
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
      # Create first note feed
      note_feed

      # Create second note feed
      record = deserialize(
        {
          data: {
            type: "dataset:note_feeds",
            attributes: note_feed_attributes.merge(content_md: "Another note"),
            relationships: {
              entry: {
                data: {
                  type: "dataset:entries",
                  id: entry_id
                }
              }
            }
          }
        }
      )
      subject.create(record)
    end

    it "returns all note feeds when no filter is provided" do
      result = subject.index

      expect(result.count).to eq(2)
    end

    it "filters note feeds by entry_id" do
      result = subject.index({ entry_id: entry_id })
      expect(result.all? { |nf| nf.entry_id == entry_id }).to be true
    end

    it "supports pagination" do
      result = subject.index({}, page: 1, items_per_page: 1)
      expect(result.count).to eq(1)
    end
  end

  describe "#show" do
    it "shows a note feed" do
      found_note_feed = subject.show(note_feed.id)
      expect(found_note_feed.id).to eq(note_feed.id)
      expect(found_note_feed.content_md).to eq("This is a test note")
    end

    it "raises error when note feed not found" do
      expect { subject.show(UUIDv7.generate) }.to raise_error(Verse::Error::NotFound)
    end

    it "includes relationships when specified" do
      result = subject.show(note_feed.id, included: ["entry"])
      expect(result.entry).not_to be_nil
      expect(result.entry.id).to eq(entry_id)
    end
  end

  describe "#update" do
    it "updates a note feed" do
      record = deserialize(
        {
          data: {
            type: "dataset:note_feeds",
            id: note_feed.id,
            attributes: {
              content_md: "Updated note content"
            }
          }
        }
      )

      result = subject.update(record)

      expect(result.content_md).to eq("Updated note content")
      expect(result.id).to eq(note_feed.id)
    end

    it "updates position" do
      record = deserialize(
        {
          data: {
            type: "dataset:note_feeds",
            id: note_feed.id,
            attributes: {
              position: { "x" => 300, "y" => 400 }
            }
          }
        }
      )

      result = subject.update(record)

      expect(result.position).to eq({ x: 300, y: 400 })
    end
  end

  describe "#delete" do
    it "deletes a note feed" do
      subject.delete(note_feed.id)
      expect { repo.find!(note_feed.id) }.to raise_error(Verse::Error::NotFound)
    end
  end

  describe "#resolve" do
    it "updates the status to resolved" do
      result = subject.resolve(note_feed.id)

      expect(result.status).to eq("resolved")
      expect(result.id).to eq(note_feed.id)
    end

    it "raises error when note feed not found" do
      expect { subject.resolve(UUIDv7.generate) }.to raise_error(Verse::Error::NotFound)
    end
  end
end
