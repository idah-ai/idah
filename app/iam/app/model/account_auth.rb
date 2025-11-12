# frozen_string_literal: true

module AccountAuth
  # pseudo record used when login or
  # refreshing token.
  class Record < Verse::Model::Record::Base
    type Resource::Iam::AccountAuths

    field :id, type: Integer

    field :email, type: String
    field :name, type: String
    field :picture_url, type: String

    field :role_name, type: String
    field :role_scope, type: Hash

    field :auth_token, type: String

    field :role_rights, type: Array

    field :auth_token, type: String, visible: false
    field :refresh_token, type: String, visible: false

    field :exp, type: Integer
  end
end
