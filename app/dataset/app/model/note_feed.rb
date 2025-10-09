# frozen_string_literal: true

module NoteFeed
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::NoteFeeds

    field :id, type: String, primary: true
    field :entry_id, type: String
    field :annotation_id, type: String
    field :created_by_id, type: Integer
    field :anchor_type, type: String
    field :position, type: Hash
    field :status, type: String, readonly: true
    field :content_md, type: String

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
    belongs_to :annotation, repository: "Annotation::Repository", foreign_key: :annotation_id
    has_many :note_comments, repository: "NoteComment::Repository", foreign_key: :note_feed_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "note_feeds"
    self.resource = Resource::Dataset::NoteFeeds

    encoder :position, Verse::Sequel::JsonEncoder
  end
end
