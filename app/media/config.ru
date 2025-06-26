# frozen_string_literal: true

require File.expand_path("config/boot.rb", __dir__)

Verse.start(:server)

run Verse::Http::Server
