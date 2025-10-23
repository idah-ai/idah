# frozen_string_literal: true

module Auth
  class SimpleExpo < BaseExpo
    include HelperMethods

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
        field(:user_agent, String).meta(description: "The user agent of the client.")
      end
      meta nodoc: true
    end
    def login
      output = service.login(
        params[:email],
        params[:password],
        ip: server_ip,
        user_agent: params[:user_agent]
      )
      set_cookies(output.auth_token, output.refresh_token) if params[:cookie]
      renderer.meta = { token: output.auth_token }
      output
    end

    expose on_http(:get, "refresh", auth: nil) do
      desc <<-MD
        Refresh the auth token using the refresh token.
        The refresh token is stored in the cookie.

        If the refresh token is invalid, the cookie will be cleared.
      MD
      meta nodoc: true
      input do
        field?(:user_agent, String)
      end
    end
    def refresh
      output = service.refresh_token(
        auth_cookie,
        refresh_cookie,
        ip: server_ip,
        user_agent: params[:user_agent]
      )

      set_cookies(output.auth_token, output.refresh_token)

      output
    rescue BadRefreshTokenError, Verse::Error::Authorization => e
      set_refresh_cookie(nil)
      e
    end
  end
end
