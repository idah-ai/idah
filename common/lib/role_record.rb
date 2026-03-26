# frozen_string_literal: true

class RoleRecord < Verse::Model::Record::Base
  type "iam/roles"

  field :name, type: String, primary: true

  field :title, type: String

  field :rights, type: Array

  field :description, type: String
  field :assignable, type: TrueClass, visible: false

  field :scopes, type: Hash

  field :labels, type: Array
end
