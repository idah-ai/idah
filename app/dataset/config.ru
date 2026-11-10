# frozen_string_literal: true

require File.expand_path("config/boot.rb", __dir__)

Verse.start(:server)

# The images may be newer than the schema; say so here rather than failing
# later in whatever query hits a missing column first.
Migration::PendingCheck.assert_current!

run Verse::Http::Server
