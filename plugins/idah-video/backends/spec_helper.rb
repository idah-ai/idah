# frozen_string_literal: true

require "bundler"
Bundler.require(:default, "test")

require "bootsnap"
Bootsnap.setup(cache_dir: "tmp/cache")

require "dotenv"

# Dotenv.load(".env", ".env.test")

require "verse/spec"
require "rspec"
require "webmock/rspec"
require "simplecov"
require "pry"

require "zeitwerk"

loader = Zeitwerk::Loader.new

# Dynamically load only existing backend service directories
backend_services = ["media", "sync"]
backend_services.each do |service|
  service_path = "./#{service}"
  loader.push_dir(service_path) if Dir.exist?(service_path)
end

# Load spec_data directory for test support classes (e.g., FakeProcessorContext)
spec_data_path = "./spec_data"
loader.push_dir(spec_data_path) if Dir.exist?(spec_data_path)

loader.setup

SimpleCov.start do
  backend_services.each do |service|
    add_group "#{service.capitalize} Service", service if Dir.exist?("./#{service}")
  end

  add_filter /_spec.rb$/
  add_filter /spec_data/
end

RSpec.configure do |config|
  config.before :each do
    allow(Verse).to receive(:logger).and_return(Logger.new(IO::NULL))
  end

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
