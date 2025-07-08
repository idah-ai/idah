# frozen_string_literal: true

desc "Run console with environment setup"
task console: :environment do
  # rubocop:disable Lint/Debugger
  require "pry"
  binding.pry
  # rubocop:enable Lint/Debugger
end
