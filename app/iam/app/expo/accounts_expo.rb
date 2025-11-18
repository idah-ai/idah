# frozen_string_literal: true

class AccountsExpo < BaseExpo
  http_path "/accounts"

  use_service Account::Service

  json_api Account::Record do
    index do
      allowed_filters :name__match,
                      :email,
                      :email__match,
                      :enabled,
                      :role_name__in,
                      :joined_at__gte,
                      :joined_at__lte,
                      :created_at__gte,
                      :created_at__lte

      blacklist_filters :hashed_password
    end

    show
    create
    update
    delete
  end

  # TODO: move to frontend logic

  expose on_http(:patch, "/:account_id/add_org_scope/:org_id") do
    desc "Add an account as organization owner"
    input do
      field :account_id, String
      field :org_id, String
    end
  end
  def add_org_scope
    service.add_org_scope(org_id: params[:org_id].to_i, account_id: params[:account_id])
  end

  expose on_http(:patch, "/:account_id/remove_org_scope/:org_id") do
    desc "Remove an account as organization owner"
    input do
      field :account_id, String
      field :org_id, String
    end
  end
  def remove_org_scope
    service.remove_org_scope(org_id: params[:org_id].to_i, account_id: params[:account_id])
  end
end
