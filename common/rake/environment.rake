# frozen_string_literal: true

task :environment do
  require "./config/boot"
  Verse.start(:task)
end
