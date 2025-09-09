# frozen_string_literal: true

module ProjectMember
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::ProjectMembers

    field :id, type: Integer, primary: true

    field :project_id, type: String, readonly: true
    
    field :user_id, type: [Integer, NilClass], readonly: true
    field :name, type: [String, NilClass]
    field :email, type: [String, NilClass]

    field :role, type: String

    field :invited_by_id, type: Integer    

    field :created_at, type: Time
    field :updated_at, type: Time

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "project_members"
    self.resource = Resource::Dataset::ProjectMembers
  end
end
