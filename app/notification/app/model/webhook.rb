# frozen_string_literal: true

module Webhook
  class Record < Verse::Model::Record::Base
    type Resource::Notification::Webhooks

    field :id, type: Integer, primary: true

    field :account_id, type: Integer, readonly: true
    field :role_name, type: String, readonly: true

    field :name, type: String
    field :url, type: String
    # Returned in full only by create; masked everywhere else (see Webhook::Service).
    field :secret, type: String, readonly: true

    field :events, type: Array
    field :enabled, type: TrueClass

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true
  end

  class Repository < Verse::Sequel::Repository
    self.table = "webhooks"
    self.resource = Resource::Notification::Webhooks

    encoder :events, Verse::Sequel::PgArrayEncoder

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }
        scope.own? { table.where(account_id: auth_context.metadata[:id]) }
      end
    end
  end
end
