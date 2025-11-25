# frozen_string_literal: true

module Account
  class Record < Verse::Model::Record::Base
    type Resource::Iam::Accounts

    field :id, type: Integer, primary: true

    field :name, type: String
    field :email, type: String, readonly: true

    field :hashed_password, type: [String, NilClass], visible: false, readonly: true
    field :password_reset_token, type: [String, NilClass], visible: false, readonly: true
    field :password_reset_token_expires_at, type: [Time, NilClass], visible: false, readonly: true

    field :sso_channel, type: [String, NilClass], readonly: true

    field :enabled, type: [TrueClass]

    field :joined_at, type: [Time, NilClass], readonly: true
    field :invitation_expired_at, type: [Time, NilClass], readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true
  end

  class Repository < Verse::Sequel::Repository
    self.table = "accounts"
    self.resource = Resource::Iam::Accounts
  end
end
