# frozen_string_literal: true

require "verse/json_api"

Api::Exposition.include(Verse::JsonApi::Deserializer)

Api[:idah].base_url = \
  [ENV.fetch("IDAH_URL"), "api/v1/"].join("/")

Api[:idah].register_service(:media).base_path = "media"
Api[:idah].register_service(:iam).base_path = "iam"
Api[:idah].register_service(:dataset).base_path = "dataset"

# Configure authentication with dynamic token generation
Api[:idah].add_auth(:bearer) do |request|
  # Generate or retrieve the token dynamically
  token = generate_token
  request["Authorization"] = "Bearer #{token}"
end

# Helper method to generate token
def generate_token
  # Check if token is still valid
  if @service_token && @service_token_expires_at && (@service_token_expires_at - Time.now.to_i) <= 60
    return @service_token
  end

  # Fetch credentials from config
  credentials = Verse::Config.config.extra_fields.fetch(:credentials) do
    raise "Credentials for API not found in config file."
  end

  # Login to get new token
  output = Api[:idah].iam.auth.login(
    email: credentials.fetch(:account),
    password: credentials.fetch(:password)
  )

  token = output.meta&.dig(:token)
  @service_token_expires_at = JSON.parse(Base64.decode64(token.split(".")[1]))["exp"] if token
  @service_token = token

  token
end
