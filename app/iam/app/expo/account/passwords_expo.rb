# frozen_string_literal: true

module Account
  class PasswordsExpo < BaseExpo
    http_path "/account/passwords"

    use_service AccountPassword::Service

    expose on_http(:post, "request_reset", auth: nil) do
      desc <<-MD
        Request a password reset for an account.

        This endpoint will send an email with a reset token to the provided email address
        if an account with that email exists.
      MD
      input do
        field(:email, String).filled
      end
    end
    def request_password_reset
      service.request_password_reset(params[:email])
      server.no_content
    end

    expose on_http(:post, "reset", auth: nil) do
      desc <<-MD
        Reset a password using a reset token.

        This endpoint will change the password for the account associated with the provided
        reset token if the token is valid and not expired.

        Password requirements:
        - Minimum 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character
      MD
      input do
        field(:token, String).filled
        field(:password, String)
          .filled
          .rule(
            "must be at least 8 characters"
          ) { |value| value.length >= 8 }
          .rule(
            "must include at least one uppercase letter"
          ) { |value| value =~ /[A-Z]/ }
          .rule(
            "must include at least one lowercase letter"
          ) { |value| value =~ /[a-z]/ }
          .rule(
            "must include at least one digit"
          ) { |value| value =~ /\d/ }
          .rule(
            "must include at least one special character"
          ) { |value| value =~ %r([!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]) }
      end
    end
    def reset_password
      service.reset_password(params[:token], params[:password])
      server.no_content
    end

    expose on_http(:get, "token_valid", auth: nil) do
      desc <<-MD
        Check if a password reset token is valid.

        This endpoint will verify if the provided token exists and has not expired.
        It returns a boolean indicating whether the token is valid.
      MD
      input do
        field(:token, String).filled
      end
      output do
        field(:valid, TrueClass)
      end
    end
    def token_valid
      { valid: service.token_valid?(params[:token]) }
    end
  end
end
