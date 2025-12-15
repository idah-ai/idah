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

        scope.as_user? { organizations_from_project_member_scoped }
      end
    end

    private

    def organizations_from_project_member_scoped
      account_id = auth_context.metadata[:id]

      memberships = Verse::Cache.with_cache(
        "dataset/datasets/service/memberships",
        "account_id:#{account_id}",
        expires_in: 180
      ) do
        Api[:idah].dataset.project_members.index(filter: { account_id: }, included: ["project"]).data
      end

      table.where(id: memberships.map{ |pm| pm.project.organization_id }.uniq)
    end
  end
end
