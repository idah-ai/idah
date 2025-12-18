# frozen_string_literal: true

module Log
  class Record < Verse::Model::Record::Base
    type Resource::Audit::Logs

    field :id, type: Integer, primary: true

    field :actor_account_id, type: Integer, readonly: true
    # field :actor_name, type: [String, NilClass], readonly: true
    # field :actor_email, type: String, readonly: true

    field :action, type: String, readonly: true
    field :resource_service, type: String, readonly: true
    field :resource_type, type: String, readonly: true
    field :resource_id, type: String, readonly: true

    # field :event_data, type: Hash, readonly: true

    field :organization_id, type: [Integer, NilClass], readonly: true
    # project_id ?, also subsequent resources' ids ?

    field :event_timestamp, type: Time, readonly: true

    field :created_at, type: Time, readonly: true
  end

  class Repository < Verse::Sequel::Repository
    self.table = "logs"
    self.resource = "audit:logs"
  end
end
