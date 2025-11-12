# frozen_string_literal: true

module Errors
  module Service
    UnauthorizedProjectAccess = Verse::Error::Unauthorized.new("You do not have access to the specified project")
  end
end
