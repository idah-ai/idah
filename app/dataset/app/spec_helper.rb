# frozen_string_literal: true

ENV["APP_ENVIRONMENT"] = "test"

require "bootsnap"
Bootsnap.setup(cache_dir: "tmp/cache")

require "webmock"
WebMock.enable!
WebMock.disable_net_connect!

require "pry"
require "simplecov"

require "verse/spec"
require "verse/http/spec"
require "verse/sequel/spec"

SimpleCov.start do
  add_group "Exposition", "app/expo"
  add_group "Model", "app/model"
  add_group "Service", "app/service"

  add_filter "app/journey"
  add_filter "config"
  add_filter "common/lib"

  add_filter /_spec.rb$/
end

require_relative "../config/boot"
Verse.start(:test)

def silent
  return unless (logger = Verse.logger)

  level = logger.level
  logger.fatal!

  yield
ensure
  logger.level = level
end

RSpec.configure do |config|
  config.before :suite do
    # Remove the files in tmp/storage/test
    FileUtils.rm_rf(
      Dir.glob("tmp/storage/test/*")
    )
  end

  # Verse::Auth::Context.backend = Service::RoleBackend.new
  Verse::Event::Dispatcher.event_mode = :immediate

  config.include Rack::Test::Methods
  config.include Verse::JsonApi::Deserializer

  config.include RSpec::Mocks::ExampleMethods
  config.include WebMock::API

  Verse::Spec.add_user(:system, "system")
  Verse::Spec.add_user(:admin, "admin", user_data: { id: 1, email: "admin@example.com", name: "Admin User" })
  Verse::Spec.add_user(
    :org_owner,
    "org_owner",
    scopes: { org: ["1"] },
    user_data: { id: 2, email: "org_owner@example.com", name: "Org Owner User" }
  )
  Verse::Spec.add_user(
    :project_owner,
    "user",
    user_data: { id: 3, email: "project_owner@example.com", name: "Project Owner User" }
  )
  Verse::Spec.add_user(:annotator, "user", user_data: { id: 4, email: "annotator@example.com", name: "Annotator User" })
  Verse::Spec.add_user(:reviewer, "user", user_data: { id: 5, email: "reviewer@example.com", name: "Reviewer User" })
  Verse::Spec.add_user(:anonymous, "anonymous")

  config.example_status_persistence_file_path = ".rspec_status"

  config.expect_with :rspec do |c|
    c.include_chain_clauses_in_custom_matcher_descriptions = true
    c.syntax = :expect
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.filter_run :focus
  config.run_all_when_everything_filtered = true

  Kernel.srand config.seed
end
