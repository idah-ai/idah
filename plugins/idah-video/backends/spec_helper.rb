# frozen_string_literal: true
require "bundler"
Bundler.require(:default, "test")

require "bootsnap"
Bootsnap.setup(cache_dir: "tmp/cache")

require "dotenv"

# Dotenv.load(".env", ".env.test")

require "rspec"
require "webmock/rspec"
require "simplecov"
require "pry"

require "zeitwerk"

loader = Zeitwerk::Loader.new
loader.push_dir("./media")
loader.setup

SimpleCov.start do
  add_group "Media Service", "media"

  add_filter /_spec.rb$/
  add_filter /spec_data/
end

require_relative "spec_data/fake_processor_context"

RSpec.configure do |config|
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