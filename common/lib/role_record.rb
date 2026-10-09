# frozen_string_literal: true

class RoleRecord < Verse::Model::Record::Base
  type "iam/roles"

  field :name, type: String, primary: true

  field :title, type: String

  field :rights, type: Array

  # Privilege level, as "major.minor.patch" (e.g. "8.0.0" for admin). The major
  # number is the privilege tier used to decide which roles a caller may assign.
  field :mask, type: String

  field :description, type: String
  field :assignable, type: TrueClass, visible: false

  field :scopes, type: Hash

  field :labels, type: Array
end
