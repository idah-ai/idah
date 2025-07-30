# frozen_string_literal: true

require "rspec"
require "webmock/rspec"
require "simplecov"

# Start SimpleCov for code coverage
SimpleCov.start do
  add_filter "/spec/"
  add_group "API", "lib/api"
end

# Configure WebMock
WebMock.disable_net_connect!(allow_localhost: true)

RSpec.configure do |config|
  # Use the expect syntax
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  # Use the new mock syntax
  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  # This option will default to `:apply_to_host_groups` in RSpec 4
  config.shared_context_metadata_behavior = :apply_to_host_groups

  # Run specs in random order to surface order dependencies
  config.order = :random

  # Seed global randomization in this process using the `--seed` CLI option
  Kernel.srand config.seed

  # Clean up WebMock after each test
  config.after(:each) do
    WebMock.reset!
  end
end
