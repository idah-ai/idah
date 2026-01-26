# frozen_string_literal: true

class AccountSessionsExpo < BaseExpo
  http_path "/account_sessions"

  use_service AccountSession::Service

  desc <<~MD
    Manage account sessions for user authentication,
    including listing active sessions and deleting sessions.
  MD

  json_api AccountSession::Record, http_opts: { auth: nil } do
    index do
      allowed_filters :account_id
    end

    delete
  end
end
