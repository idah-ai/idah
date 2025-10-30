# frozen_string_literal: true

module NoteComment
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::NoteComments

    field :id, type: String, primary: true
    field :note_feed_id, type: String

    field :content_md, type: String
    field :created_by_email, type: String, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true
    field :edited_at, type: Time

    belongs_to :note_feed, repository: "NoteFeed::Repository", foreign_key: :note_feed_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "note_comments"
    self.resource = Resource::Dataset::NoteComments
  end
end
