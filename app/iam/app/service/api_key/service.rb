# frozen_string_literal: true

module ApiKey
  class Service < Verse::Service::Base
    use_repo \
      api_keys: ApiKey::Repository

    use_system_repo \
      system_roles: RoleRepository,
      accounts: Account::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 100, sort: nil, query_count: false)
      api_keys.index(
        filter,
        included:,
        page:,
        items_per_page:,
        sort:,
        query_count:
      )
    end

    def show(id, included: [])
      api_keys.find!(id, included:)
    end

    def create(record)
      api_keys.transaction do
        attr = record.attributes.dup

        permissions = attr[:permissions] || []

        # Validate permissions against what the current user can do
        permissions &= auth_context.can!(
          :create,
          "iam:api_keys"
        ) do |scope|
          # Reduce permissions to the ones the current role has
          scope.array? { |elms| elms.map(&:to_s) }
          scope.all? { permissions }
        end

        raise Verse::Error::CannotCreateRecord, "Invalid API Key permission." if permissions.empty?

        # Generate random API key
        raw_key = "IDAH_#{SecureRandom.hex(32)}"

        # Compute SHA digest for storage
        attr[:key_sha] = Digest::SHA256.hexdigest(raw_key)

        # Generate key label (first 10 characters + ... + last 4 characters)
        attr[:key_label] = "#{raw_key[0..9]}...#{raw_key[-4..]}"

        attr[:permissions] = permissions

        # Validate scope_type
        unless %w[all org project].include?(attr[:scope_type])
          raise Verse::Error::ValidationFailed, "Invalid scope_type. Must be 'all', 'org', or 'project'."
        end

        # Validate scope_value
        attr[:scope_value] ||= []
        if attr[:scope_type] != "all" && attr[:scope_value].empty?
          raise Verse::Error::ValidationFailed, "scope_value cannot be empty for scope_type '#{attr[:scope_type]}'."
        end

        service_account = accounts.find_by({ role_name: "api_service" })
        raise Verse::Error::RecordNotFound, "Service account not found" unless service_account

        attr[:account_id] = service_account.id

        attr[:status] ||= "active"

        # Create API key record
        id = api_keys.create(attr)

        api_key_record = api_keys.find!(id)

        # Return the record with the raw API key (only returned once)
        ApiKey::Record.new(
          {
            **api_key_record.fields,
            key: raw_key
          }
        )
      end
    end

    def update(record)
      api_keys.transaction do
        updatable_attributes = record.attributes.slice(:expires_at, :name)
        api_key = api_keys.find!(record.id)

        if api_key.revoked?
          raise Verse::Error::ValidationFailed, "Cannot update a revoked API key"
        end

        if api_key.expired?
          raise Verse::Error::ValidationFailed, "Cannot update an expired API key"
        end

        if updatable_attributes[:expires_at] && updatable_attributes[:expires_at] < Time.now
          raise Verse::Error::ValidationFailed, "expires_at must be in the future"
        end

        api_keys.update!(record.id, updatable_attributes)
        api_keys.find!(record.id)
      end
    end

    def delete(id)
      api_keys.delete!(id)
    end

    def revoke(id)
      api_keys.transaction do
        api_keys.update!(id, { revoked_at: Time.now, status: "revoked" })
        api_keys.find!(id)
      end
    end

    def show_permissions
      # Get all available API permissions based on current user's role
      auth_context.can!(:create, "iam:api_keys") do |scope|
        scope.all? { api_permission_list }
        scope.array? { |allowed_permissions|
          # Return only the permissions that the user is allowed to create
          api_permission_list.select { |permission| allowed_permissions.include?(permission.name.to_sym) }
        }
      end
    end

    def expire_api_keys
      # Find all API keys that have expired but status is still 'active'
      expired_keys = api_keys.chunked_index({ expires_at__lte: Time.now, status: "active" }).to_a

      expired_keys.each do |key|
        api_keys.update!(key.id, { status: "expired" })
      end
    end

    private

    def api_permission_list
      # Get all API roles from the system and extract permissions

      system_roles.chunked_index({ name__match: %r{^api/} }).map do |role|
        name = role.name.split("/")[1]
        title = role.title
        description = role.description

        ApiPermission::Record.new(
          {
            name:,
            title:,
            description:
          }
        )
      end
    end
  end
end
