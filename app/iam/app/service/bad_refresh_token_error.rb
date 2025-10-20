# frozen_string_literal: true

module Service
  BadRefreshTokenError = Class.new(Verse::Error::Authorization)
end
