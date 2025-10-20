# frozen_string_literal: true

module Auth
  class SimpleExpo < BaseExpo
    http_path "/auth"

    use_service Auth::Service

    expose on_http(:get, "logout") do
      desc <<-MD
        Logout the current user, clean-up cookies and publish a `iam:accounts:logged_out`
        event, which can be used to pause the user's work session.
      MD
      meta nodoc: true
    end
    def logout
      auth_context.mark_as_checked!

      set_cookies(nil, nil)

      server.no_content
    end

    expose on_http(:post, "login", auth: nil) do
      desc "Login using email and password strategy."
      input do
        field(:email, String).filled
        field(:password, String).filled
        field?(:cookie, TrueClass).meta(
          description: <<-MD
            If true, set the auth and refresh token as cookies
            in the return response.
          MD
        )
      end
      meta nodoc: true
    end
    def login
      output = service.login(params[:email], params[:password], ip: server_ip)
      set_cookies(output.auth_token, output.refresh_token) if params[:cookie]
      renderer.meta = { token: output.auth_token }
      output
    end
  end
end
