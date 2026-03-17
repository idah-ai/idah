# frozen_string_literal: true

module Auth
  class ApiExpo < BaseExpo
    http_path "/auth/api"

    use_service Auth::Service

    expose on_http(:post, "login", auth: nil) do
      desc <<-MD
        Authenticate using an API key.
        Client should send the API key in the request body.
        Returns a JWT token that can be used for subsequent API calls.
      MD
      input do
        field(:api_key, String).meta(
          description: <<-MD
            The API key. Should be provided in the request body.
          MD
        )
        field?(:token_expiration, Integer).meta(
          description: <<-MD
            Token expiration time in seconds. Default is 3600 (1 hour).
          MD
        )
      end
      meta nodoc: true
    end
    def login
      key = params[:api_key]

      output = service.login_api(
        key,
        ip: "",
        token_expiration: params[:token_expiration] || 3600
      )

      renderer.meta = { token: output.auth_token }
      output
    end
  end
end
