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

  expose on_http(:patch, "/:id/join", auth: nil) do
    desc "Mark account as joined when user accepts invitation"
    input do
      field :id, String
    end
  end
  def join
    account, password_reset_token = service.mark_as_joined(params[:id])
    renderer.meta = {
      password_reset_token: password_reset_token
    }

    account
  end

  expose on_http(:post, "/:id/resend_invitation", auth: nil) do
    desc "Resend account invitation email"
    input do
      field :id, String
    end
  end
  def resend_invitation
    service.resend_pending_invitations(params[:id])
  end
end
