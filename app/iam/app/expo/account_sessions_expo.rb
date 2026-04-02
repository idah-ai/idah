# frozen_string_literal: true

# Test CI/CD

class AccountSessionsExpo < BaseExpo
  http_path "/account_sessions"

  use_service AccountSession::Service

  desc <<~MD
    Manage account sessions for user authentication,
    including listing active sessions and deleting sessions.
  MD

  json_api AccountSession::Record do
    allowed_included "account"

    index do
      allowed_filters :account_id
    end

    delete
  end
end
