# frozen_string_literal: true

module Auth
  module HelperMethods
    def self.included(base)
      base.use_service(Auth::Service)
    end

    protected

    # those are following the header name Set-Cookie convention
    # rubocop:disable Naming/AccessorMethodName

    def set_cookies(auth_token, refresh_token)
      set_refresh_cookie(refresh_token)
      set_auth_cookie(auth_token)
    end

    def set_refresh_cookie(value)
      if value
        server.response.set_cookie(
          Settings["refresh_token.name"],
          value:,
          path: Settings["refresh_token.path"],
          expires: Time.now + Settings["refresh_token.lifetime"],
          http_only: true,
          secure: true
        )
      else
        # Force expiration of the cookie as we can't delete a cookie
        server.response.set_cookie(
          Settings["refresh_token.name"],
          value: "",
          path: Settings["refresh_token.path"],
          expires: Time.now - 600, # 10 minutes ago
          http_only: true,
          secure: true
        )
      end
    end

    def set_auth_cookie(value)
      if value
        server.response.set_cookie(
          Settings["auth_token.name"],
          value:,
          path: Settings["auth_token.path"],
          expires: Time.now + Settings["auth_token.lifetime"],
          http_only: true,
          secure: true
        )
      else
        # Force expiration of the cookie as we can't delete a cookie
        server.response.set_cookie(
          Settings["auth_token.name"],
          value: "",
          path: Settings["auth_token.path"],
          expires: Time.now - 600,
          http_only: true,
          secure: true
        )
      end
    end
    # rubocop:enable Naming/AccessorMethodName

    def server_ip
      (env["HTTP_X_REAL_IP"] || env["REMOTE_ADDR"])&.split(", ")&.first
    end

    def auth_cookie
      server.cookies[
        Settings["auth_token.name"]
      ]
    end

    def refresh_cookie
      server.cookies[
        Settings["refresh_token.name"]
      ]
    end
  end
end
