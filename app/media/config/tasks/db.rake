# frozen_string_literal: true

namespace :db do
  task :init_migration do
    require "sequel/core"
    Sequel.extension :migration

    Rake::Task["environment"].invoke
  end

  namespace :test do
    desc "Prepare test database"
    task :prepare do
      ENV["APP_ENVIRONMENT"] = "test"
      Rake::Task["db:reset"].invoke
      Rake::Task["db:migrate"].invoke
    end
  end

  desc "Reset database"
  task reset: :environment do
    unless %w(staging development test).include?(ENV["APP_ENVIRONMENT"])
      raise "This is too dangerous to use in production! Create/Replace manually the database"
    end

    uri = URI.parse(ENV.fetch("DATABASE_URI"))
    db_to_create = uri.path[1..]
    uri.path = "/postgres"

    Sequel.connect(uri.to_s, logger: Logger.new($stdout)) do |db|
      drop_sql = "DROP DATABASE IF EXISTS #{db_to_create}"
      db.execute drop_sql

      create_sql = "CREATE DATABASE #{db_to_create}"
      db.execute create_sql
    end
  end

  desc "Run migrations"
  task :migrate, [:version] do |_t, args|
    Rake::Task["db:init_migration"].invoke

    version = args[:version].to_i if args[:version]

    Sequel.connect(ENV.fetch("DATABASE_URI"), logger: Logger.new($stdout)) do |db|
      Sequel::Migrator.run(db, "db/migrations", target: version)
    end
  end
end
