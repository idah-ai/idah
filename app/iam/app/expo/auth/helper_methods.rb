# frozen_string_literal: true

module Auth
  module HelperMethods
    AUTH_TOKEN_NAME      = "auth-token"
    AUTH_TOKEN_PATH      = "/"
    AUTH_TOKEN_LIFETIME  = 86_400 # 1 day

    REFRESH_TOKEN_NAME      = "refresh-token"
    REFRESH_TOKEN_PATH      = "/api/v1/iam"
    REFRESH_TOKEN_LIFETIME  = 1_209_600 # 14 days

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
          REFRESH_TOKEN_NAME,
          value:,
          path: REFRESH_TOKEN_PATH,
          expires: Time.now + REFRESH_TOKEN_LIFETIME,
          http_only: true,
          secure: true
        )
      else
        # Force expiration of the cookie as we can't delete a cookie
        server.response.set_cookie(
          REFRESH_TOKEN_NAME,
          value: "",
          path: REFRESH_TOKEN_PATH,
          expires: Time.now - 600, # 10 minutes ago
          http_only: true,
          secure: true
        )
      end
    end

    def set_auth_cookie(value)
      if value
        server.response.set_cookie(
          AUTH_TOKEN_NAME,
          value:,
          path: AUTH_TOKEN_PATH,
          expires: Time.now + AUTH_TOKEN_LIFETIME,
          http_only: true,
          secure: true
        )
      else
        # Force expiration of the cookie as we can't delete a cookie
        server.response.set_cookie(
          AUTH_TOKEN_NAME,
          value: "",
          path: AUTH_TOKEN_PATH,
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
        AUTH_TOKEN_NAME
      ]
    end

    def refresh_cookie
      server.cookies[
        REFRESH_TOKEN_NAME
      ]
    end
  end
end
