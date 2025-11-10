# frozen_string_literal: true

require File.expand_path("config/boot.rb", __dir__)

Verse.start(:server)
GC.start
GC.compact

run Verse::Http::Server
