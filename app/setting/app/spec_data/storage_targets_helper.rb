# frozen_string_literal: true

# Auth contexts and records shared by the storage target specs.
module SpecData
  module StorageTargetsHelper
    SECRET = "LEAK-CANARY-123"

    ADMIN_RIGHTS = %w[read create update delete test list_available].map { |action|
      "setting:storage_targets.#{action}.*"
    }.freeze

    def admin_context
      Verse::Auth::Context.new(
        ADMIN_RIGHTS,
        role: :admin,
        metadata: { id: 1, email: "admin@test.com", role: :admin }
      )
    end

    def org_owner_context(org_ids)
      Verse::Auth::Context.new(
        ["setting:storage_targets.list_available.as_org_owner"],
        role: :org_owner,
        custom_scopes: { org: org_ids.map(&:to_s) },
        metadata: { id: 2, email: "owner@test.com", role: :org_owner }
      )
    end

    def system_context
      Verse::Auth::Context.new(["*.*.*"], role: :system, metadata: {})
    end

    # A target as the service stores it: the secret encrypted, after the insert.
    def create_target(secret: SECRET, **attributes)
      repo = StorageTarget::Repository.new(system_context)
      id = UUIDv7.generate

      repo.create(
        {
          id:,
          name: "Target #{id[-6..]}",
          endpoint: "https://s3.example.com",
          region: "eu-west-1",
          bucket: "customer-bucket",
          prefix: "acme",
          access_key_id: "AKIAEXAMPLE",
          organization_ids: [],
          enabled: true,
          **attributes
        }
      )
      repo.set_secret!(id, ciphertext: SecretBox.from_env.encrypt(secret), hint: secret[-4..])

      id
    end
  end
end
