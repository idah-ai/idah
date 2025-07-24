# frozen_string_literal: true

task :environment do
  require_relative "../boot"
  Verse.start(:task)
end
