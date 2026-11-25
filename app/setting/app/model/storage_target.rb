# frozen_string_literal: true

# An S3 location an admin registers, for projects whose files must be kept
# apart. The secret key is encrypted at rest (SecretBox) and is never part of a
# record: a new one comes in through the create and update input schemas only
# (StorageTargetsExpo), and only Credentials, for the system role, carries it
# out.
module StorageTarget
  # Columns that say where the files are: fixed once the target exists, or the
  # files already stored there could no longer be found.
  LOCATION_FIELDS = %i[endpoint region bucket prefix].freeze

  class Record < Verse::Model::Record::Base
    type Resource::Setting::StorageTargets

    field :id, type: String, primary: true

    field :name, type: String

    field :endpoint, type: String
    field :region, type: [String, NilClass]
    field :bucket, type: String
    field :prefix, type: [String, NilClass]

    # Path-style addressing (endpoint/bucket/key), which self-hosted S3 services
    # such as MinIO or Ceph need.
    field :path_style, type: TrueClass

    field :access_key_id, type: String
    # The last 4 characters of the secret, so an admin can tell which one is set.
    field :secret_hint, type: [String, NilClass], readonly: true

    field :organization_ids, type: Array
    field :enabled, type: TrueClass

    field :deleted_at, type: [Time, NilClass], readonly: true
    field :created_by, type: [Integer, NilClass], readonly: true
    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    def inspect
      "#<#{self.class.name} id=#{id.inspect} name=#{name.inspect} bucket=#{bucket.inspect}>"
    end
    alias to_s inspect
  end

  # What a project creator sees when picking a target: no credentials.
  class Summary < Verse::Model::Record::Base
    type Resource::Setting::StorageTargets

    field :id, type: String, primary: true
    field :name, type: String
    field :endpoint, type: String
    field :bucket, type: String
  end

  # A target's location and decrypted credentials, for the media and sync
  # services only (system role).
  class Credentials < Verse::Model::Record::Base
    type Resource::Setting::StorageTargets

    field :id, type: String, primary: true
    field :endpoint, type: String
    field :region, type: [String, NilClass]
    field :bucket, type: String
    field :prefix, type: [String, NilClass]
    field :path_style, type: TrueClass
    field :access_key_id, type: String
    field :secret_access_key, type: String

    def inspect
      "#<#{self.class.name} id=#{id.inspect} [REDACTED]>"
    end
    alias to_s inspect
  end

  class Repository < Verse::Sequel::Repository
    include ActorEventMetadata

    self.table = "storage_targets"
    self.resource = Resource::Setting::StorageTargets

    encoder :organization_ids, Verse::Sequel::PgArrayEncoder

    # Admins manage every target that isn't archived. `list_available` is the
    # enabled targets a project creator may pick: all of them for an admin, those
    # allowed for one of their organizations for an org owner. `credentials`
    # (system role only) also reaches archived targets, whose files stay
    # readable.
    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? do
          case action
          when :credentials then table
          when :list_available then available
          else table.where(deleted_at: nil)
          end
        end

        scope.as_org_owner? do
          org_ids = Array(auth_context.custom_scopes[:org]).map(&:to_i)

          available.where(Sequel.lit("organization_ids && ?::integer[]", Sequel.pg_array(org_ids)))
        end
      end
    end

    # The targets a project creator may pick, without credentials; only those
    # allowing `organization_id` when given, as a new project of that
    # organization may only use those.
    def available_targets(organization_id: nil)
      scope = scoped(:list_available)
      scope = scope.where(Sequel.lit("? = ANY(organization_ids)", organization_id.to_i)) if organization_id

      index({}, scope:, record: Summary, items_per_page: 1_000, sort: ["name"])
    end

    # A target for the credentials route (system role), archived ones included.
    def find_for_credentials!(id)
      find!(id, scope: scoped(:credentials))
    end

    # Updates a target; `secret_changed` goes in the event metadata so audit and
    # the services caching credentials know, while the secret itself is stored
    # by `set_secret!`, which publishes nothing.
    def update_target!(id, attributes, secret_changed: false)
      with_metadata do
        add_metadata(secret_changed:)

        update!(id, attributes)
      end
    end

    # The encrypted secret of a target the actor may `action` on.
    def secret_ciphertext(id, action: :read)
      with_db_mode :r do
        scoped(action).where(id:).get(:secret_ciphertext)
      end
    end

    # Stores a new encrypted secret. No event: the secret must not travel with
    # one. The service publishes the change through `update!` with
    # `secret_changed` in the metadata.
    #
    # The write goes through a bound-parameter statement on the raw connection:
    # Sequel logs every statement with its values, and the ciphertext in a log
    # plus the master key would give the secret back. The scope check and the
    # existence check run through Sequel as usual; they carry no secret. Same
    # connection, so the write stays in the caller's transaction.
    def set_secret!(id, ciphertext:, hint:)
      with_db_mode :rw do
        raise Verse::Error::RecordNotFound, id unless scoped(:update).where(id:).count.positive?

        client do |db|
          db.synchronize do |connection|
            connection.exec_params(
              "UPDATE storage_targets SET secret_ciphertext = $1, secret_hint = $2 WHERE id = $3",
              [ciphertext, hint, id]
            )
          end
        end
      end
    end

    # Archives a target: it disappears from the admin's lists and can't be
    # picked anymore, but its credentials are still served, so the files of the
    # projects using it stay readable.
    event(name: "deleted")
    def archive!(id)
      with_db_mode :rw do
        updated = scoped(:delete).where(id:).update(deleted_at: Time.now, enabled: false)
        raise Verse::Error::RecordNotFound, id if updated.zero?
      end

      true
    end

    private

    def available
      table.where(enabled: true, deleted_at: nil)
    end
  end
end
