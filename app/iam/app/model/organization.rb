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

    private def organizations_from_project_member_scoped
      account_id = auth_context.metadata[:id]
      memberships = Api[:idah].dataset.project_members.index(filter: { account_id: }, included: ["project"]).data

      table.where(id: memberships.map { |pm| pm.project.organization_id }.uniq)
    end

    def create(attributes)
      with_metadata do
        add_metadata(
          actor_account_id: auth_context.metadata[:account_id],
          actor_account_email: auth_context.metadata[:email]
        )

        super(attributes)
      end
    end

    def update!(id, attributes, scope: scoped(:update))
      with_metadata do
        add_metadata(
          actor_account_id: auth_context.metadata[:account_id],
          actor_account_email: auth_context.metadata[:email],
          organization_id: id
        )

        super(id, attributes, scope:)
      end
    end

    def delete!(id)
      with_metadata do
        organization = find!(id)

        if organization
          add_metadata(
            actor_account_id: auth_context.metadata[:account_id],
            actor_account_email: auth_context.metadata[:email],
            organization_id: id
          )
        end

        super(id)
      end
    end
  end
end
