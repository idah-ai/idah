# frozen_string_literal: true

module Account
  class Service < Verse::Service::Base
    use accounts: Account::Repository,
        organization_service: Organization::Service

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      accounts.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      accounts.find!(id, included: included)
    end

    def create(record)
      accounts.transaction do
        email = record.attributes[:email]

        if accounts.find_by({ email: email })
          raise Verse::Error::ValidationFailed, "Email already exists"
        end

        # Set a default random password for the account if none is provided
        password = record.attributes.delete(:password) || SecureRandom.hex(16)
        record.attributes[:hashed_password] = BCrypt::Password.create(password)

        record_id = accounts.create(record.attributes)
        accounts.find!(record_id)
      end
    end

    def update(record)
      accounts.update!(record.id, record.attributes)
      accounts.find!(record.id)
    end

    def delete(id)
      accounts.delete(id)
    end

    # TODO: should allow only admin/system for this action
    def add_owner(org_id:, account_id:)
      organization_service.show(org_id)
      # TODO: error / fail fast here

      account = accounts.find!(account_id)
      # update_role_name = "org_owner" if account.role_name == "user"
      update_role_scope = account.role_scope || {}
      update_role_scope[:org] ||= []
      (update_role_scope[:org] << org_id).uniq!

      update_attr = { role_scope: update_role_scope }
      update_attr[:role_name] = "org_owner" if account.role_name == "user"

      accounts.update!(account_id, update_attr)

      accounts.find!(account_id)
    end

    # TODO: should allow only admin/system for this action
    def remove_owner(org_id:, account_id:)
      pass
    end
  end
end
