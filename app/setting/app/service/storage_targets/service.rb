# frozen_string_literal: true

module StorageTargets
  # Storage targets: S3 locations an admin registers so a project's files can be
  # kept apart from other customers' data.
  #
  # The secret key is tested before it is saved, stored encrypted (SecretBox),
  # and never returned except by `#credentials`, which only the system role (the
  # media and sync services) may call. The location can't change once the
  # target exists; archiving keeps the credentials, so files stay readable.
  class Service < Verse::Service::Base
    use_repo storage_targets: StorageTarget::Repository

    CREATE_FIELDS = %i[name endpoint region bucket prefix path_style access_key_id organization_ids enabled].freeze
    UPDATE_FIELDS = %i[name path_style access_key_id organization_ids enabled].freeze
    REQUIRED_ON_CREATE = %i[name endpoint bucket access_key_id secret_access_key].freeze

    # Shorter secrets show no hint: 4 characters would be too much of them.
    HINT_MIN_SECRET_LENGTH = 12

    def index(filter = {}, included: [], page: 1, items_per_page: 100, sort: nil, query_count: false)
      storage_targets.index(filter, included:, page:, items_per_page:, sort:, query_count:)
    end

    def show(id, included: [])
      storage_targets.find!(id, included:)
    end

    def create(input)
      authorize!(:create)

      attributes = normalize(input.attributes || {})

      missing = REQUIRED_ON_CREATE.select { |key| blank?(attributes[key]) }
      raise Verse::Error::ValidationFailed, "missing: #{missing.join(", ")}" if missing.any?

      secret = attributes.delete(:secret_access_key)
      check_connection!(
        **attributes.slice(*StorageTarget::LOCATION_FIELDS, :access_key_id),
        path_style: attributes[:path_style] == true,
        secret_access_key: secret
      )

      id = UUIDv7.generate

      storage_targets.transaction do
        storage_targets.create(
          attributes.slice(*CREATE_FIELDS).merge(
            id:,
            prefix: attributes[:prefix] || "",
            path_style: attributes[:path_style] == true,
            organization_ids: attributes[:organization_ids] || [],
            enabled: attributes.fetch(:enabled, false),
            created_by: auth_context.metadata[:id]
          )
        )
        store_secret(id, secret)

        storage_targets.find!(id)
      end
    end

    def update(input)
      authorize!(:update)

      target = storage_targets.find!(input.id)
      attributes = normalize(input.attributes || {})

      moved = StorageTarget::LOCATION_FIELDS.select { |key|
        attributes.key?(key) && attributes[key].to_s != target.public_send(key).to_s
      }
      if moved.any?
        raise Verse::Error::ValidationFailed,
              "#{moved.join(", ")} can't be changed: the files already stored there would be lost. " \
              "Create a new target instead."
      end

      secret = attributes.delete(:secret_access_key)
      secret = nil if blank?(secret)
      new_key_id = attributes.key?(:access_key_id) && attributes[:access_key_id] != target.access_key_id

      if new_key_id && secret.nil?
        raise Verse::Error::ValidationFailed, "a new access_key_id needs its secret_access_key"
      end

      path_style = attributes.fetch(:path_style, target.path_style) == true

      # New credentials, or another way of addressing the bucket: test first.
      if secret || path_style != (target.path_style == true)
        check_connection!(
          **location_of(target),
          path_style:,
          access_key_id: attributes.fetch(:access_key_id, target.access_key_id),
          secret_access_key: secret || secret_box.decrypt(storage_targets.secret_ciphertext(target.id))
        )
      end

      storage_targets.transaction do
        storage_targets.update_target!(
          target.id,
          attributes.slice(*UPDATE_FIELDS).merge(updated_at: Time.now),
          secret_changed: !secret.nil?
        )
        store_secret(target.id, secret) if secret

        storage_targets.find!(target.id)
      end
    end

    # Archives the target. It must be disabled first, so no new project picks
    # it while it is being retired.
    def delete(id)
      target = storage_targets.find!(id)

      if target.enabled
        raise Verse::Error::ValidationFailed, "disable the target before archiving it"
      end

      storage_targets.archive!(target.id)
    end

    # Tests values from the admin's form before they are saved.
    def test_connection(attributes)
      authorize!(:test)

      attributes = normalize(attributes)
      error = connection_test.call(
        **attributes.slice(*StorageTarget::LOCATION_FIELDS, :access_key_id),
        path_style: attributes[:path_style] == true,
        secret_access_key: attributes[:secret_access_key]
      )

      { ok: error.nil?, error: }
    end

    # Tests a saved target with its stored secret.
    def test_saved(id)
      authorize!(:test)

      target = storage_targets.find!(id)
      error = connection_test.call(
        **location_of(target),
        path_style: target.path_style == true,
        access_key_id: target.access_key_id,
        secret_access_key: secret_box.decrypt(storage_targets.secret_ciphertext(target.id))
      )

      { ok: error.nil?, error: }
    end

    # The targets the actor may pick for a new project, without credentials;
    # with `organization_id`, only those a project of that organization may use.
    def available(organization_id: nil)
      storage_targets.available_targets(organization_id:)
    end

    # A target's location and decrypted credentials. System role only: the
    # media and sync services, which store the files.
    def credentials(id)
      target = storage_targets.find_for_credentials!(id)

      StorageTarget::Credentials.new(
        {
          **location_of(target),
          id: target.id,
          path_style: target.path_style == true,
          access_key_id: target.access_key_id,
          secret_access_key: secret_box.decrypt(storage_targets.secret_ciphertext(target.id, action: :credentials))
        }
      )
    end

    private

    def authorize!(action)
      auth_context.can!(action, Resource::Setting::StorageTargets) do |scope|
        scope.all? { true }
      end
    end

    def check_connection!(secret_access_key:, **target)
      error = connection_test.call(**target, secret_access_key:)
      return unless error

      raise Verse::Error::ValidationFailed, "connection test failed: #{error}"
    end

    def store_secret(id, secret)
      hint = secret.length >= HINT_MIN_SECRET_LENGTH ? secret[-4..] : nil

      storage_targets.set_secret!(id, ciphertext: secret_box.encrypt(secret), hint:)
    end

    def location_of(target)
      StorageTarget::LOCATION_FIELDS.to_h { |key| [key, target.public_send(key)] }
    end

    # Trimmed strings, a prefix without slashes at either end (they would double
    # up in every key), and organization ids as integers.
    def normalize(attributes)
      attributes = attributes.to_h.transform_keys(&:to_sym)
      attributes = attributes.transform_values { |value| value.is_a?(String) ? value.strip : value }

      attributes[:prefix] = attributes[:prefix].to_s.gsub(%r{\A/+|/+\z}, "") if attributes.key?(:prefix)
      attributes[:region] = nil if attributes.key?(:region) && blank?(attributes[:region])

      if attributes.key?(:organization_ids)
        attributes[:organization_ids] = Array(attributes[:organization_ids]).map(&:to_i).uniq
      end

      attributes
    end

    def blank?(value)
      value.nil? || value.to_s.strip.empty?
    end

    def connection_test
      @connection_test ||= ConnectionTest.new
    end

    def secret_box
      @secret_box ||= SecretBox.from_env
    end
  end
end
