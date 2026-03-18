# frozen_string_literal: true

module ApiPermission
  class Record < Verse::Model::Record::Base
    field :name, type: String, primary: true
    field :title, type: String
    field :description, type: String
  end
end
