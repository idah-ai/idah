# frozen_string_literal: true

current_env = ENV["APP_ENVIRONMENT"] ||= "development"
require "dotenv"
require "pry"

# COMMON_PATH = ENV["COMMON_PATH"] || File.expand_path("../../../../common", __dir__)

puts "Loading \"#{current_env}\" environment..."
Dotenv.load(".env", ".env.#{current_env}")

require "bundler"
Bundler.require(:default, current_env)

COMMON_PATH = File.expand_path("../../../common", __dir__)

ENV["APP_PATH"] = File.expand_path("..", __dir__)

require "zeitwerk"

loader = Zeitwerk::Loader.new
loader.push_dir(File.join(ENV["APP_PATH"], "app"))
loader.push_dir(File.join(ENV["APP_PATH"], "app", "expo"))
loader.push_dir(File.join(ENV["APP_PATH"], "app", "model"))
loader.push_dir(File.join(ENV["APP_PATH"], "app", "service"))
loader.push_dir(File.join(ENV["APP_PATH"], "app", "util"))
loader.push_dir(File.join(ENV["APP_PATH"], "common", "lib"))

loader.inflector.inflect("uuid_v7" => "UUIDv7")

loader.setup

require_relative "./routes"

Dir[File.join(__dir__, "initializers/**.rb")].each do |file|
  load file
end
