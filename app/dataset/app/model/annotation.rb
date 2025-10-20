# frozen_string_literal: true

module Annotation
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Annotations

    field :id, type: String, primary: true

    field :entry_id, type: String, readonly: true

    field :dimensions, type: Hash
    field :annotation, type: Hash

    field :created_by_id, type: Integer, readonly: true
    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "annotations"
    self.resource = Resource::Dataset::Annotations

    encoder :dimensions, Verse::Sequel::JsonEncoder
    encoder :annotation, Verse::Sequel::JsonEncoder

    # scope definition(s)
    def scoped(action)
      auth_context.can!(action, Resource::Dataset::Entries) do |scope|
        scope.all? { table }

        # TODO: to be reviewed
        scope.as_user? { table }
      end
    end
  end
end
