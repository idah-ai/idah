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
      auth_context.reject! unless auth_context.can?(:update, accounts.class.resource)

      record.attributes[:role_scope] = (record.attributes[:role_scope] || {}).to_json
      accounts.update!(record.id, record.attributes)
      accounts.find!(record.id)
    end

    def delete(id)
      accounts.delete(id)
    end
  end
end
