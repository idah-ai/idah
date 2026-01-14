# frozen_string_literal: true

require_relative "./gen/template"
require_relative "./gen/open_api_generator"

require "pry"

namespace :http do
  desc "Auto-generate API based on data from hooks"
  task generate_api: :environment do
    output = Http::Gen::Template.generate

    domain_path = File.expand_path("../../api_service/domains", __dir__)
    file = File.join(domain_path, "#{Verse.service_name}.rb")
    puts "Writing #{file}..."
    File.write(file, output)
  end

  desc "Generate swagger JSON files (OpenAPI)"
  task generate_swagger: :environment do
    output = Http::Gen::OpenApiGenerator.generate
    domain = Verse.service_name

    output_file_path = ENV["OUTPUT_FILE"] || "."
    output_file = File.join(output_file_path, "#{domain}.json")

    puts "Writing #{output_file}..."
    File.write(output_file, output)
  end
end
