# frozen_string_literal: true

class AccountsExpo < BaseExpo
  http_path "/accounts"

  use_service Account::Service

  json_api Account::Record, http_opts: { auth: nil } do
    index do
      allowed_filters :name__match, :email__match, :enabled, :joined_at__gte, :joined_at__lte, :created_at__gte, :created_at__lte
    end

    show
    create
    update
    delete
  end
end