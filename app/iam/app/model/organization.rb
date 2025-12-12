# frozen_string_literal: true

module Organization
  class Record < Verse::Model::Record::Base
    type Resource::Iam::Organizations

    field :id, type: Integer, primary: true

    field :name, type: String

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true
  end

  class Repository < Verse::Sequel::Repository
    self.table = "organizations"
    self.resource = Resource::Iam::Organizations

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context[:org] || []
          table.where(id: org_ids)
        end
      end
    end
  end
end
