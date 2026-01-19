# frozen_string_literal: true

class AccountSessionsExpo < BaseExpo
  http_path "/account_sessions"

  use_service AccountSession::Service

  json_api AccountSession::Record do
    allowed_included "account"

    index do
      allowed_filters :account_id
    end

    delete
  end
end
