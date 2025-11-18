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
      record.attributes[:role_scope] = (record.attributes[:role_scope] || {}).to_json
      accounts.update!(record.id, record.attributes)
      accounts.find!(record.id)
    end

    def delete(id)
      accounts.delete(id)
    end

    def add_org_scope(org_id:, account_id:)
      begin
        organization_service.show(org_id)
      rescue Verse::Error::RecordNotFound
        raise Verse::Error::ValidationFailed, "Invalid organization"
      end

      account = accounts.find!(account_id)
      return account if account.role_name == "admin" ||
                        (account.role_name == "org_owner" && account.role_scope&.dig("org")&.include?(org_id))

      update_role_scope = JSON.parse((account.role_scope || {}).to_json)
      update_role_scope["org"] ||= []
      (update_role_scope["org"] << org_id).uniq!

      update_attr = { role_scope: update_role_scope.to_json }
      update_attr[:role_name] = "org_owner" if account.role_name == "user"

      accounts.update!(account_id, update_attr)
      accounts.find!(account_id)
    end

    def remove_org_scope(org_id:, account_id:)
      account = accounts.find!(account_id)
      return account unless account.role_name == "org_owner" || account.role_scope&.dig("org")&.include?(org_id)

      update_role_scope = JSON.parse((account.role_scope || {}).to_json)
      update_role_scope["org"]&.delete(org_id)

      # clean up empty org array
      update_role_scope.delete("org") if update_role_scope["org"] && update_role_scope["org"].empty?

      update_attr = { role_scope: update_role_scope.to_json }
      update_attr[:role_name] = "user" if update_role_scope.empty? && account.role_name != "user"

      accounts.update!(account_id, update_attr)
      accounts.find!(account_id)
    end
  end
end
