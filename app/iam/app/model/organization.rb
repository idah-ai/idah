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
    include ActorEventMetadata

    self.table = "organizations"
    self.resource = Resource::Iam::Organizations

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context[:org] || []

          if action == :read
            # Read union: the actor's own orgs ∪ the orgs of their memberships,
            # so an org_owner who is a member of a foreign project can read that
            # project's org.
            membership_org_ids = ProjectMembership::Lookup.new.memberships_for(auth_context.metadata[:id])
              .map(&:organization_id)

            table.where(id: (org_ids + membership_org_ids).uniq)
          else
            # Updates stay limited to the actor's own orgs (foreign memberships
            # never widen the update scope), like Account::Repository#scoped.
            table.where(id: org_ids)
          end
        end

        scope.as_user? { organizations_from_project_member_scoped }
      end
    end

    def create(attributes)
      with_metadata do
        add_event_metadata

        super(attributes)
      end
    end

    def update!(id, attributes, scope: scoped(:update))
      with_metadata do
        add_event_metadata(organization_id: id)

        super(id, attributes, scope:)
      end
    end

    def delete!(id)
      with_metadata do
        find!(id)

        add_event_metadata(organization_id: id)

        super(id)
      end
    end

    private

    def organizations_from_project_member_scoped
      account_id = auth_context.metadata[:id]
      org_ids = ProjectMembership::Lookup.new.memberships_for(account_id).map(&:organization_id).uniq

      table.where(id: org_ids)
    end

    def add_event_metadata(**opts)
      add_metadata(**opts)
    end
  end
end
