# frozen_string_literal: true

module Migration
  # Refuses to serve against a schema the code does not expect.
  #
  # Upgrading an install is two steps: new images, then their migrations.
  # Running only the first leaves the services talking to the old schema, which
  # shows up later as missing columns in unrelated places. Checked once at boot
  # instead, with the command that fixes it.
  #
  # Only where the two steps are separate: development migrates on the way up in
  # dev-entrypoint.sh, and the suite prepares the test database itself.
  module PendingCheck
    extend self

    MIGRATED_ON_START = %w[development test].freeze

    def assert_current!
      return if MIGRATED_ON_START.include?(ENV.fetch("APP_ENVIRONMENT", "development"))
      return if ENV["IDAH_SKIP_MIGRATION_CHECK"] == "true"

      require "sequel"
      Sequel.extension :migration

      directory = File.join(ENV.fetch("APP_PATH", Dir.pwd), "db", "migrations")
      return unless Dir.exist?(directory)

      # allow_missing_migration_files: an older release's migrations are applied
      # but no longer shipped, which is expected and not what this looks for.
      return if Sequel::Migrator.is_current?(database, directory, allow_missing_migration_files: true)

      abort <<~MESSAGE
        #{database_name} is missing migrations this code brings. To apply them:

            ./install.sh --upgrade

        Serving against the old schema would fail later, in places that do not
        name the cause, so this service stops here instead. To start anyway,
        set IDAH_SKIP_MIGRATION_CHECK=true.
      MESSAGE
    rescue Sequel::DatabaseConnectionError => e
      # The database being unreachable is its own problem, reported elsewhere.
      warn "could not check for pending migrations: #{e.message.lines.first&.strip}"
    end

    private

    # The database this service uses, for a message that says which one.
    def database_name
      URI.parse(ENV.fetch("DATABASE_URI")).path.delete_prefix("/")
    rescue StandardError
      "This database"
    end

    # The connection the service already has, when it has one.
    def database
      return Sequel::Model.db if defined?(Sequel::Model) && Sequel::Model.db

      Sequel.connect(ENV.fetch("DATABASE_URI"))
    rescue Sequel::Error
      Sequel.connect(ENV.fetch("DATABASE_URI"))
    end
  end
end
